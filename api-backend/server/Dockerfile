FROM node:18-alpine

# Install necessary dependencies for native modules
RUN apk add --no-cache python3 make g++ sqlite

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data

# Build TypeScript (if needed)
RUN npm run build || echo "No build script found"

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S relay -u 1001

# Change ownership of app directory
RUN chown -R relay:nodejs /app
USER relay

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/stats || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/relay.db

# Enable SQLite WAL mode on startup
CMD ["sh", "-c", "sqlite3 ${DATABASE_PATH} 'PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA cache_size=10000; PRAGMA temp_store=memory;' && npm start"]