import express from 'express';
import cors from 'cors';
import { registerRoutes } from './server/routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration for static frontend
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://app.yourdomain.com',
  credentials: true
}));

app.use(express.json());

// Register API routes
await registerRoutes(app);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`YHGS Bridge API running on port ${PORT}`);
});
