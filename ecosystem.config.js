module.exports = {
  apps: [{
    name: 'yhgs-bridge',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      // Database configuration
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/yhgs_bridge',
      PGHOST: process.env.PGHOST || 'localhost',
      PGPORT: process.env.PGPORT || '5432',
      PGUSER: process.env.PGUSER || 'postgres',
      PGPASSWORD: process.env.PGPASSWORD || '',
      PGDATABASE: process.env.PGDATABASE || 'yhgs_bridge',
      // Production optimizations
      NODE_OPTIONS: '--max-old-space-size=1024',
      UV_THREADPOOL_SIZE: '128'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    merge_logs: true
  }]
}