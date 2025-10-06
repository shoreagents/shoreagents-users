module.exports = {
  apps: [
    {
      name: 'shoreagents-socket-server',
      script: 'socket-server.js',
      instances: 1,
      exec_mode: 'fork',
      
      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      // Restart policies
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3004
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3004
      },
      
      // Logging configuration
      log_file: './logs/socket-server-combined.log',
      out_file: './logs/socket-server-out.log',
      error_file: './logs/socket-server-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Advanced restart conditions
      kill_timeout: 5000,
      listen_timeout: 10000,
      wait_ready: true,
      
      // Health monitoring
      health_check_grace_period: 3000,
      
      // Memory and CPU limits
      max_memory_restart: '800M',
      
      // Process management
      merge_logs: true,
      time: true,
      
      // Advanced PM2 features
      source_map_support: true,
      instance_var: 'INSTANCE_ID',
      
      // Custom restart conditions
      cron_restart: '0 2 * * *', // Daily restart at 2 AM
      
      // Environment-specific settings
      node_args: '--max-old-space-size=1024',
      
      // Advanced monitoring
      monitoring: true,
      
      // Custom restart script
      restart_delay: 5000,
      
      // Error handling
      exp_backoff_restart_delay: 100,
      
      // Process title
      process_title: 'shoreagents-socket-server'
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'node',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:shoreagents/shoreagents-users.git',
      path: '/var/www/shoreagents-users',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};
