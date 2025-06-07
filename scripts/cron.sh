#!/bin/bash

# YHGS Multi-Chain Bridge Periodic Maintenance Script
# Handles database optimization, backups, and cleanup

set -e

# Configuration
DB_PATH="${DATABASE_PATH:-/app/data/relay.db}"
BACKUP_DIR="${BACKUP_DIR:-/app/data/backups}"
LOG_FILE="${LOG_FILE:-/app/data/maintenance.log}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Database maintenance function
maintain_database() {
    log "Starting database maintenance"
    
    # Check if database exists
    if [ ! -f "$DB_PATH" ]; then
        log "Database not found at $DB_PATH, skipping maintenance"
        return 0
    fi
    
    # Ensure WAL mode and optimized settings
    sqlite3 "$DB_PATH" << EOF
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = memory;
PRAGMA mmap_size = 268435456;
PRAGMA wal_autocheckpoint = 1000;
EOF
    
    log "Database PRAGMA settings optimized"
    
    # Run VACUUM to reclaim space
    sqlite3 "$DB_PATH" "VACUUM;"
    log "Database VACUUM completed"
    
    # Analyze tables for query optimization
    sqlite3 "$DB_PATH" "ANALYZE;"
    log "Database ANALYZE completed"
    
    # Check integrity
    integrity_result=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;")
    if [ "$integrity_result" = "ok" ]; then
        log "Database integrity check passed"
    else
        log "WARNING: Database integrity check failed: $integrity_result"
    fi
}

# Backup function
backup_database() {
    log "Starting database backup"
    
    if [ ! -f "$DB_PATH" ]; then
        log "Database not found, skipping backup"
        return 0
    fi
    
    # Create timestamp-based backup filename
    timestamp=$(date '+%Y%m%d_%H%M%S')
    backup_file="$BACKUP_DIR/relay_backup_$timestamp.db"
    compressed_backup="$backup_file.gz"
    
    # Create backup using SQLite backup command
    sqlite3 "$DB_PATH" ".backup $backup_file"
    
    # Compress the backup
    gzip "$backup_file"
    
    log "Database backup created: $compressed_backup"
    
    # Get backup size
    backup_size=$(du -h "$compressed_backup" | cut -f1)
    log "Backup size: $backup_size"
    
    # Clean up old backups (keep last 7 days)
    find "$BACKUP_DIR" -name "relay_backup_*.db.gz" -mtime +7 -delete
    log "Old backups cleaned up"
}

# Cleanup function
cleanup_old_data() {
    log "Starting data cleanup"
    
    if [ ! -f "$DB_PATH" ]; then
        log "Database not found, skipping cleanup"
        return 0
    fi
    
    # Clean up processed events older than 30 days
    deleted_count=$(sqlite3 "$DB_PATH" "
    DELETE FROM processed_events 
    WHERE status = 'processed' 
    AND created_at < strftime('%s', 'now', '-30 days');
    SELECT changes();
    ")
    
    log "Cleaned up $deleted_count old processed events"
    
    # Clean up failed events older than 7 days
    failed_deleted=$(sqlite3 "$DB_PATH" "
    DELETE FROM processed_events 
    WHERE status = 'failed' 
    AND created_at < strftime('%s', 'now', '-7 days');
    SELECT changes();
    ")
    
    log "Cleaned up $failed_deleted old failed events"
}

# WAL checkpoint function
checkpoint_wal() {
    log "Starting WAL checkpoint"
    
    if [ ! -f "$DB_PATH" ]; then
        log "Database not found, skipping WAL checkpoint"
        return 0
    fi
    
    # Force WAL checkpoint
    sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE);"
    log "WAL checkpoint completed"
}

# Health check function
health_check() {
    log "Starting health check"
    
    # Check database file permissions
    if [ -r "$DB_PATH" ] && [ -w "$DB_PATH" ]; then
        log "Database file permissions OK"
    else
        log "WARNING: Database file permissions issue"
    fi
    
    # Check available disk space
    available_space=$(df -h "$(dirname "$DB_PATH")" | awk 'NR==2 {print $4}')
    log "Available disk space: $available_space"
    
    # Check database size
    if [ -f "$DB_PATH" ]; then
        db_size=$(du -h "$DB_PATH" | cut -f1)
        log "Database size: $db_size"
    fi
    
    # Check WAL file size
    wal_file="$DB_PATH-wal"
    if [ -f "$wal_file" ]; then
        wal_size=$(du -h "$wal_file" | cut -f1)
        log "WAL file size: $wal_size"
    fi
}

# Main execution
case "${1:-maintenance}" in
    "maintenance")
        log "=== Starting periodic maintenance ==="
        maintain_database
        cleanup_old_data
        checkpoint_wal
        health_check
        log "=== Maintenance completed ==="
        ;;
    "backup")
        log "=== Starting backup ==="
        backup_database
        log "=== Backup completed ==="
        ;;
    "cleanup")
        log "=== Starting cleanup ==="
        cleanup_old_data
        log "=== Cleanup completed ==="
        ;;
    "health")
        log "=== Starting health check ==="
        health_check
        log "=== Health check completed ==="
        ;;
    "full")
        log "=== Starting full maintenance ==="
        maintain_database
        backup_database
        cleanup_old_data
        checkpoint_wal
        health_check
        log "=== Full maintenance completed ==="
        ;;
    *)
        echo "Usage: $0 {maintenance|backup|cleanup|health|full}"
        echo "  maintenance - Database optimization and WAL checkpoint"
        echo "  backup     - Create compressed database backup"
        echo "  cleanup    - Remove old processed events"
        echo "  health     - System health check"
        echo "  full       - All operations"
        exit 1
        ;;
esac