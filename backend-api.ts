// src/server.ts
import express, { Express } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';
import { Queue } from 'bullmq';
import { register } from 'prom-client';
import winston from 'winston';
import { z } from 'zod';
import dotenv from 'dotenv';

// Import routes
import bridgeRoutes from './routes/bridge.routes';
import analyticsRoutes from './routes/analytics.routes';
import liquidityRoutes from './routes/liquidity.routes';
import validatorRoutes from './routes/validator.routes';

// Import middleware
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logging.middleware';
import { cacheMiddleware } from './middleware/cache.middleware';
import { authMiddleware } from './middleware/auth.middleware';
import { metricsMiddleware } from './middleware/metrics.middleware';

// Import services
import { WebSocketService } from './services/websocket.service';
import { EventListenerService } from './services/event-listener.service';
import { ValidatorService } from './services/validator.service';

dotenv.config();

// Initialize logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Initialize Redis
export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));
redisClient.on('connect', () => logger.info('Redis Client Connected'));

// Initialize BullMQ
export const bridgeQueue = new Queue('bridge-transactions', {
  connection: redisClient,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Dynamic rate limiter based on address risk score
const dynamicRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  keyGenerator: (req) => {
    // Extract address from request
    const address = req.body?.sender || req.query?.address || req.ip;
    return address;
  },
  max: async (req) => {
    // Get risk score from cache/db
    const address = req.body?.sender || req.query?.address || req.ip;
    const riskScore = await getRiskScore(address);
    
    // Adjust rate limit based on risk
    if (riskScore > 80) return 1; // High risk: 1 request/hour
    if (riskScore > 50) return 3; // Medium risk: 3 requests/hour
    return 5; // Low risk: 5 requests/hour
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
});

// Risk score calculation (simplified)
async function getRiskScore(address: string): Promise<number> {
  const cacheKey = `risk:${address}`;
  const cached = await redisClient.get(cacheKey);
  
  if (cached) return parseInt(cached);
  
  // Simple risk scoring logic
  let score = 0;
  
  // Check transaction history
  // Check blacklists
  // Check velocity patterns
  // etc.
  
  await redisClient.setEx(cacheKey, 3600, score.toString());
  return score;
}

// Create Express app
const app: Express = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
});

// Initialize services
const wsService = new WebSocketService(io);
const eventListener = new EventListenerService(wsService);
const validatorService = new ValidatorService();

// Global middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(requestLogger);

// Metrics
app.use(metricsMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redis: redisClient.isReady,
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  const metrics = await register.metrics();
  res.end(metrics);
});

// API routes
app.use('/api/v1/bridge', dynamicRateLimiter, bridgeRoutes);
app.use('/api/v1/analytics', cacheMiddleware(30), analyticsRoutes);
app.use('/api/v1/liquidity', authMiddleware, liquidityRoutes);
app.use('/api/v1/validator', authMiddleware, validatorRoutes);

// Error handling
app.use(errorHandler);

// WebSocket handlers
io.on('connection', (socket) => {
  logger.info(`WebSocket client connected: ${socket.id}`);
  
  socket.on('subscribe', (data: { event: string; params?: any }) => {
    wsService.subscribe(socket, data.event, data.params);
  });
  
  socket.on('unsubscribe', (data: { event: string }) => {
    wsService.unsubscribe(socket, data.event);
  });
  
  socket.on('disconnect', () => {
    logger.info(`WebSocket client disconnected: ${socket.id}`);
  });
});

// Start services
async function startServices() {
  try {
    // Connect to Redis
    await redisClient.connect();
    
    // Start event listener
    await eventListener.start();
    
    // Start validator service
    await validatorService.start();
    
    // Start server
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`WebSocket server ready`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start services:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  await eventListener.stop();
  await validatorService.stop();
  await bridgeQueue.close();
  await redisClient.quit();
  
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
startServices().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

// ===== Route Implementations =====

// src/routes/bridge.routes.ts
import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { BridgeController } from '../controllers/bridge.controller';
import { asyncHandler } from '../utils/async-handler';

const router = Router();
const bridgeController = new BridgeController();

// Validation schemas
const depositSchema = [
  body('token').isEthereumAddress().withMessage('Invalid token address'),
  body('amount').isNumeric().withMessage('Invalid amount'),
  body('dstChain').isInt().withMessage('Invalid destination chain'),
  body('receiver').isEthereumAddress().withMessage('Invalid receiver address'),
];

const withdrawSchema = [
  body('txHash').isHexadecimal().isLength({ min: 64, max: 66 }).withMessage('Invalid transaction hash'),
  body('proof').isObject().withMessage('Invalid proof'),
  body('aggSignature').isHexadecimal().withMessage('Invalid signature'),
];

// Routes
router.post(
  '/deposit',
  depositSchema,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const result = await bridgeController.deposit(req.body);
    res.json(result);
  })
);

router.post(
  '/withdraw',
  withdrawSchema,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const result = await bridgeController.withdraw(req.body);
    res.json(result);
  })
);

router.get(
  '/status/:txHash',
  asyncHandler(async (req, res) => {
    const status = await bridgeController.getTransactionStatus(req.params.txHash);
    res.json(status);
  })
);

router.get(
  '/fees/estimate',
  query('token').isEthereumAddress(),
  query('amount').isNumeric(),
  query('srcChain').isInt(),
  query('dstChain').isInt(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const estimate = await bridgeController.estimateFees(req.query);
    res.json(estimate);
  })
);

router.get(
  '/transactions',
  query('address').optional().isEthereumAddress(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  asyncHandler(async (req, res) => {
    const transactions = await bridgeController.getTransactions(req.query);
    res.json(transactions);
  })
);

export default router;

// ===== Service Implementations =====

// src/services/websocket.service.ts
import { Server, Socket } from 'socket.io';
import { logger } from '../server';

export class WebSocketService {
  private io: Server;
  private subscriptions: Map<string, Set<string>> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  subscribe(socket: Socket, event: string, params?: any) {
    const room = this.getRoomName(event, params);
    socket.join(room);
    
    if (!this.subscriptions.has(room)) {
      this.subscriptions.set(room, new Set());
    }
    this.subscriptions.get(room)!.add(socket.id);
    
    logger.info(`Socket ${socket.id} subscribed to ${room}`);
  }

  unsubscribe(socket: Socket, event: string) {
    const rooms = Array.from(socket.rooms).filter(room => room.startsWith(event));
    rooms.forEach(room => {
      socket.leave(room);
      this.subscriptions.get(room)?.delete(socket.id);
    });
  }

  emit(event: string, data: any, params?: any) {
    const room = this.getRoomName(event, params);
    this.io.to(room).emit(event, data);
    
    logger.debug(`Emitted ${event} to ${this.subscriptions.get(room)?.size || 0} clients`);
  }

  private getRoomName(event: string, params?: any): string {
    if (!params) return event;
    
    const paramStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join(':');
      
    return `${event}:${paramStr}`;
  }
}

// src/services/event-listener.service.ts
import { ethers } from 'ethers';
import { WebSocketService } from './websocket.service';
import { bridgeQueue } from '../server';
import { logger } from '../server';
import { db } from '../db';
import { bridgeTransactions } from '../../drizzle/schema';

export class EventListenerService {
  private providers: Map<number, ethers.Provider> = new Map();
  private contracts: Map<number, ethers.Contract> = new Map();
  private wsService: WebSocketService;
  private isRunning = false;

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
  }

  async start() {
    if (this.isRunning) return;
    
    logger.info('Starting event listener service...');
    
    // Initialize providers and contracts for each network
    const networks = await db.query.networks.findMany({ 
      where: eq(networks.isActive, true) 
    });
    
    for (const network of networks) {
      const provider = new ethers.JsonRpcProvider(network.rpcUrl);
      this.providers.set(network.chainId, provider);
      
      const contract = new ethers.Contract(
        network.bridgeContract,
        BRIDGE_ABI,
        provider
      );
      this.contracts.set(network.chainId, contract);
      
      // Subscribe to events
      this.subscribeToEvents(network.chainId, contract);
    }
    
    this.isRunning = true;
    logger.info('Event listener service started');
  }

  async stop() {
    logger.info('Stopping event listener service...');
    
    // Remove all listeners
    for (const contract of this.contracts.values()) {
      contract.removeAllListeners();
    }
    
    this.providers.clear();
    this.contracts.clear();
    this.isRunning = false;
    
    logger.info('Event listener service stopped');
  }

  private subscribeToEvents(chainId: number, contract: ethers.Contract) {
    // Listen for DepositRequested events
    contract.on('DepositRequested', async (...args) => {
      try {
        const event = args[args.length - 1];
        const { 
          txHash, 
          sender, 
          token, 
          amount, 
          srcChain, 
          dstChain, 
          recipient 
        } = event.args;
        
        logger.info(`DepositRequested on chain ${chainId}:`, {
          txHash,
          sender,
          amount: amount.toString(),
        });
        
        // Store in database
        await db.insert(bridgeTransactions).values({
          txHash,
          srcChain,
          dstChain,
          srcTxHash: event.transactionHash,
          token,
          amount: amount.toString(),
          fee: '0', // Calculate fee
          sender,
          recipient: ethers.getAddress(recipient),
          status: 'pending',
          requiredSignatures: 5, // From config
        });
        
        // Add to processing queue
        await bridgeQueue.add('process-deposit', {
          txHash,
          chainId,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
        });
        
        // Emit WebSocket event
        this.wsService.emit('bridge:deposit', {
          txHash,
          status: 'pending',
          srcChain,
          dstChain,
          amount: amount.toString(),
          token,
        }, { txHash });
        
      } catch (error) {
        logger.error('Error processing DepositRequested event:', error);
      }
    });
    
    // Listen for WithdrawalCompleted events
    contract.on('WithdrawalCompleted', async (...args) => {
      try {
        const event = args[args.length - 1];
        const { txHash, recipient, token, amount } = event.args;
        
        logger.info(`WithdrawalCompleted on chain ${chainId}:`, {
          txHash,
          recipient,
          amount: amount.toString(),
        });
        
        // Update transaction status
        await db
          .update(bridgeTransactions)
          .set({
            status: 'completed',
            dstTxHash: event.transactionHash,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(bridgeTransactions.txHash, txHash));
        
        // Emit WebSocket event
        this.wsService.emit('bridge:completed', {
          txHash,
          status: 'completed',
          dstTxHash: event.transactionHash,
        }, { txHash });
        
      } catch (error) {
        logger.error('Error processing WithdrawalCompleted event:', error);
      }
    });
  }
}

// Bridge ABI (simplified)
const BRIDGE_ABI = [
  'event DepositRequested(bytes32 indexed txHash, address indexed sender, address indexed token, uint256 amount, uint256 srcChain, uint256 dstChain, bytes recipient)',
  'event WithdrawalCompleted(bytes32 indexed txHash, address indexed recipient, address indexed token, uint256 amount)',
];