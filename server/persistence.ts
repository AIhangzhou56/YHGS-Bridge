import Database from 'better-sqlite3';
import { join } from 'path';

interface ProcessedEvent {
  id?: number;
  transactionHash: string;
  logIndex: number;
  nonce: string;
  blockNumber: number;
  blockHash: string;
  confirmationBlock: number;
  status: 'pending' | 'confirmed' | 'processed' | 'failed';
  mintTxHash?: string;
  processedAt: number;
  createdAt: number;
}

export class RelayPersistence {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const path = dbPath || process.env.DATABASE_PATH || join(process.cwd(), 'relay.db');
    this.db = new Database(path);
    
    // Enable WAL mode for better concurrency and crash safety
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 10000');
    this.db.pragma('temp_store = memory');
    this.db.pragma('mmap_size = 268435456'); // 256MB
    
    this.initializeDatabase();
    console.log(`Database initialized with WAL mode at: ${path}`);
  }

  private initializeDatabase(): void {
    // Create processed_events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS processed_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_hash TEXT NOT NULL,
        log_index INTEGER NOT NULL,
        nonce TEXT NOT NULL UNIQUE,
        block_number INTEGER NOT NULL,
        block_hash TEXT NOT NULL,
        confirmation_block INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        mint_tx_hash TEXT,
        processed_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        UNIQUE(transaction_hash, log_index)
      )
    `);

    // Create index for efficient queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_processed_events_nonce ON processed_events(nonce);
      CREATE INDEX IF NOT EXISTS idx_processed_events_status ON processed_events(status);
      CREATE INDEX IF NOT EXISTS idx_processed_events_block ON processed_events(block_number);
      CREATE INDEX IF NOT EXISTS idx_processed_events_confirmation ON processed_events(confirmation_block);
    `);

    // Create relay_config table for storing configuration
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relay_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )
    `);

    console.log('Database initialized successfully');
  }

  // Store a new event with pending status
  storeEvent(event: Omit<ProcessedEvent, 'id' | 'createdAt' | 'processedAt'>): boolean {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO processed_events (
          transaction_hash, log_index, nonce, block_number, block_hash, 
          confirmation_block, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        event.transactionHash,
        event.logIndex,
        event.nonce,
        event.blockNumber,
        event.blockHash,
        event.confirmationBlock,
        event.status
      );

      return result.changes > 0;
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        console.log(`Event already exists: ${event.transactionHash}-${event.logIndex}`);
        return false;
      }
      console.error('Error storing event:', error);
      throw error;
    }
  }

  // Check if event is already processed
  isEventProcessed(transactionHash: string, logIndex: number): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM processed_events 
      WHERE transaction_hash = ? AND log_index = ?
    `);
    
    const result = stmt.get(transactionHash, logIndex) as { count: number };
    return result.count > 0;
  }

  // Check if nonce is already used
  isNonceUsed(nonce: string): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM processed_events 
      WHERE nonce = ?
    `);
    
    const result = stmt.get(nonce) as { count: number };
    return result.count > 0;
  }

  // Get events that need confirmation check
  getEventsAwaitingConfirmation(currentBlock: number, confirmationDepth: number): ProcessedEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM processed_events 
      WHERE status = 'pending' 
      AND block_number <= ? 
      AND confirmation_block <= ?
      ORDER BY block_number ASC
    `);
    
    const requiredConfirmationBlock = currentBlock - confirmationDepth;
    return stmt.all(currentBlock, requiredConfirmationBlock) as ProcessedEvent[];
  }

  // Update event status to confirmed (ready for processing)
  markEventConfirmed(transactionHash: string, logIndex: number): boolean {
    const stmt = this.db.prepare(`
      UPDATE processed_events 
      SET status = 'confirmed' 
      WHERE transaction_hash = ? AND log_index = ? AND status = 'pending'
    `);
    
    const result = stmt.run(transactionHash, logIndex);
    return result.changes > 0;
  }

  // Mark event as processed with mint transaction hash
  markEventProcessed(transactionHash: string, logIndex: number, mintTxHash: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE processed_events 
      SET status = 'processed', mint_tx_hash = ?, processed_at = strftime('%s', 'now')
      WHERE transaction_hash = ? AND log_index = ?
    `);
    
    const result = stmt.run(mintTxHash, transactionHash, logIndex);
    return result.changes > 0;
  }

  // Mark event as failed
  markEventFailed(transactionHash: string, logIndex: number, error?: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE processed_events 
      SET status = 'failed', mint_tx_hash = ?
      WHERE transaction_hash = ? AND log_index = ?
    `);
    
    const result = stmt.run(error || 'Processing failed', transactionHash, logIndex);
    return result.changes > 0;
  }

  // Get confirmed events ready for processing
  getConfirmedEvents(limit: number = 10): ProcessedEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM processed_events 
      WHERE status = 'confirmed' 
      ORDER BY block_number ASC, log_index ASC 
      LIMIT ?
    `);
    
    return stmt.all(limit) as ProcessedEvent[];
  }

  // Get processing statistics
  getStats(): {
    total: number;
    pending: number;
    confirmed: number;
    processed: number;
    failed: number;
    lastProcessedBlock: number;
  } {
    try {
      // Check if table exists first
      const tableExists = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='processed_events'
      `).get();

      if (!tableExists) {
        console.log('processed_events table does not exist yet, returning zero stats');
        return {
          total: 0,
          pending: 0,
          confirmed: 0,
          processed: 0,
          failed: 0,
          lastProcessedBlock: 0
        };
      }

      const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM processed_events');
      const pendingStmt = this.db.prepare("SELECT COUNT(*) as count FROM processed_events WHERE status = 'pending'");
      const confirmedStmt = this.db.prepare("SELECT COUNT(*) as count FROM processed_events WHERE status = 'confirmed'");
      const processedStmt = this.db.prepare("SELECT COUNT(*) as count FROM processed_events WHERE status = 'processed'");
      const failedStmt = this.db.prepare("SELECT COUNT(*) as count FROM processed_events WHERE status = 'failed'");
      const lastBlockStmt = this.db.prepare("SELECT MAX(block_number) as block FROM processed_events WHERE status = 'processed'");

      return {
        total: (totalStmt.get() as { count: number }).count,
        pending: (pendingStmt.get() as { count: number }).count,
        confirmed: (confirmedStmt.get() as { count: number }).count,
        processed: (processedStmt.get() as { count: number }).count,
        failed: (failedStmt.get() as { count: number }).count,
        lastProcessedBlock: (lastBlockStmt.get() as { block: number | null }).block || 0
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return {
        total: 0,
        pending: 0,
        confirmed: 0,
        processed: 0,
        failed: 0,
        lastProcessedBlock: 0
      };
    }
  }

  // Store relay configuration
  setConfig(key: string, value: string): boolean {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO relay_config (key, value, updated_at) 
      VALUES (?, ?, strftime('%s', 'now'))
    `);
    
    const result = stmt.run(key, value);
    return result.changes > 0;
  }

  // Get relay configuration
  getConfig(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM relay_config WHERE key = ?');
    const result = stmt.get(key) as { value: string } | undefined;
    return result?.value || null;
  }

  // Get last processed block number
  getLastProcessedBlock(): number {
    const stored = this.getConfig('last_processed_block');
    return stored ? parseInt(stored) : 0;
  }

  // Update last processed block
  updateLastProcessedBlock(blockNumber: number): void {
    this.setConfig('last_processed_block', blockNumber.toString());
  }

  // Clean up old processed events (older than 30 days)
  cleanupOldEvents(daysToKeep: number = 30): number {
    const cutoffTime = Math.floor(Date.now() / 1000) - (daysToKeep * 24 * 60 * 60);
    
    const stmt = this.db.prepare(`
      DELETE FROM processed_events 
      WHERE status = 'processed' AND processed_at < ?
    `);
    
    const result = stmt.run(cutoffTime);
    console.log(`Cleaned up ${result.changes} old processed events`);
    return result.changes;
  }

  // Get recent events for monitoring
  getRecentEvents(limit: number = 50): ProcessedEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM processed_events 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    
    return stmt.all(limit) as ProcessedEvent[];
  }

  // Close database connection
  close(): void {
    this.db.close();
  }

  // Backup database
  backup(backupPath: string): void {
    this.db.backup(backupPath);
    console.log(`Database backed up to: ${backupPath}`);
  }

  // Check database integrity
  checkIntegrity(): boolean {
    try {
      const result = this.db.pragma('integrity_check');
      return Array.isArray(result) && result.length === 1 && result[0] === 'ok';
    } catch (error) {
      console.error('Database integrity check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const relayPersistence = new RelayPersistence();