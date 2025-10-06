module.exports = {
  apps: [
    {
      name: 'shoreagents-socket-server',
      script: 'socket-server.js',
      instances: 1,
      exec_mode: 'fork',
      
      // Railway-optimized settings
      autorestart: true,
      watch: false,
      max_memory_restart: '512M', // Lower memory limit for Railway
      
      // Restart policies optimized for Railway
      min_uptime: '5s',
      max_restarts: 5,
      restart_delay: 2000,
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3004
      },
      
      // Railway-specific logging
      log_file: '/dev/stdout',
      out_file: '/dev/stdout',
      error_file: '/dev/stderr',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Railway-optimized timeouts
      kill_timeout: 3000,
      listen_timeout: 5000,
      wait_ready: true,
      
      // Health monitoring for Railway
      health_check_grace_period: 2000,
      
      // Memory limits for Railway
      max_memory_restart: '512M',
      
      // Process management
      merge_logs: true,
      time: true,
      
      // Railway-specific settings
      source_map_support: false, // Disable for production
      instance_var: 'INSTANCE_ID',
      
      // Disable cron restart in Railway (Railway handles this)
      // cron_restart: '0 2 * * *', // Commented out for Railway
      
      // Node.js optimization for Railway
      node_args: '--max-old-space-size=512',
      
      // Error handling optimized for Railway
      exp_backoff_restart_delay: 50,
      
      // Process title
      process_title: 'shoreagents-socket-server-railway'
    }
  ]
};
