module.exports = {
  apps: [
    {
      name: 'break-reminder-scheduler',
      script: 'scripts/break-reminder-scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      
      // Railway-optimized settings
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      
      // Restart policies optimized for Railway
      min_uptime: '5s',
      max_restarts: 5,
      restart_delay: 2000,
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PM2_HOME: '/app/.pm2'
      },
      
      // Railway-specific logging (use stdout/stderr)
      log_file: '/dev/stdout',
      out_file: '/dev/stdout',
      error_file: '/dev/stderr',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Railway-optimized timeouts
      kill_timeout: 3000,
      listen_timeout: 5000,
      wait_ready: true,
      
      // Memory limits for Railway
      max_memory_restart: '256M',
      
      // Process management
      merge_logs: true,
      time: true,
      
      // Railway-specific settings
      source_map_support: false,
      instance_var: 'INSTANCE_ID',
      
      // Error handling optimized for Railway
      exp_backoff_restart_delay: 50,
      
      // Process title
      process_title: 'break-reminder-scheduler-railway',
      
      // PM2 specific settings for containers
      pmx: false,
      vizion: false,
      
      // Use in-memory storage for PM2 in containers
      pm2_home: '/app/.pm2'
    },
    {
      name: 'task-notification-scheduler',
      script: 'scripts/task-notification-scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      
      // Railway-optimized settings
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      
      // Restart policies optimized for Railway
      min_uptime: '5s',
      max_restarts: 5,
      restart_delay: 2000,
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PM2_HOME: '/app/.pm2'
      },
      
      // Railway-specific logging (use stdout/stderr)
      log_file: '/dev/stdout',
      out_file: '/dev/stdout',
      error_file: '/dev/stderr',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Railway-optimized timeouts
      kill_timeout: 3000,
      listen_timeout: 5000,
      wait_ready: true,
      
      // Memory limits for Railway
      max_memory_restart: '256M',
      
      // Process management
      merge_logs: true,
      time: true,
      
      // Railway-specific settings
      source_map_support: false,
      instance_var: 'INSTANCE_ID',
      
      // Error handling optimized for Railway
      exp_backoff_restart_delay: 50,
      
      // Process title
      process_title: 'task-notification-scheduler-railway',
      
      // PM2 specific settings for containers
      pmx: false,
      vizion: false,
      
      // Use in-memory storage for PM2 in containers
      pm2_home: '/app/.pm2'
    },
    {
      name: 'meeting-scheduler',
      script: 'scripts/meeting-scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      
      // Railway-optimized settings
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      
      // Restart policies optimized for Railway
      min_uptime: '5s',
      max_restarts: 5,
      restart_delay: 2000,
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PM2_HOME: '/app/.pm2'
      },
      
      // Railway-specific logging (use stdout/stderr)
      log_file: '/dev/stdout',
      out_file: '/dev/stdout',
      error_file: '/dev/stderr',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Railway-optimized timeouts
      kill_timeout: 3000,
      listen_timeout: 5000,
      wait_ready: true,
      
      // Memory limits for Railway
      max_memory_restart: '256M',
      
      // Process management
      merge_logs: true,
      time: true,
      
      // Railway-specific settings
      source_map_support: false,
      instance_var: 'INSTANCE_ID',
      
      // Error handling optimized for Railway
      exp_backoff_restart_delay: 50,
      
      // Process title
      process_title: 'meeting-scheduler-railway',
      
      // PM2 specific settings for containers
      pmx: false,
      vizion: false,
      
      // Use in-memory storage for PM2 in containers
      pm2_home: '/app/.pm2'
    },
    {
      name: 'event-reminder-scheduler',
      script: 'scripts/event-reminder-scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      
      // Railway-optimized settings
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      
      // Restart policies optimized for Railway
      min_uptime: '5s',
      max_restarts: 5,
      restart_delay: 2000,
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PM2_HOME: '/app/.pm2'
      },
      
      // Railway-specific logging (use stdout/stderr)
      log_file: '/dev/stdout',
      out_file: '/dev/stdout',
      error_file: '/dev/stderr',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Railway-optimized timeouts
      kill_timeout: 3000,
      listen_timeout: 5000,
      wait_ready: true,
      
      // Memory limits for Railway
      max_memory_restart: '256M',
      
      // Process management
      merge_logs: true,
      time: true,
      
      // Railway-specific settings
      source_map_support: false,
      instance_var: 'INSTANCE_ID',
      
      // Error handling optimized for Railway
      exp_backoff_restart_delay: 50,
      
      // Process title
      process_title: 'event-reminder-scheduler-railway',
      
      // PM2 specific settings for containers
      pmx: false,
      vizion: false,
      
      // Use in-memory storage for PM2 in containers
      pm2_home: '/app/.pm2'
    },
    {
      name: 'announcement-scheduler',
      script: 'scripts/announcement-scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      
      // Railway-optimized settings
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      
      // Restart policies optimized for Railway
      min_uptime: '5s',
      max_restarts: 5,
      restart_delay: 2000,
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PM2_HOME: '/app/.pm2'
      },
      
      // Railway-specific logging (use stdout/stderr)
      log_file: '/dev/stdout',
      out_file: '/dev/stdout',
      error_file: '/dev/stderr',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Railway-optimized timeouts
      kill_timeout: 3000,
      listen_timeout: 5000,
      wait_ready: true,
      
      // Memory limits for Railway
      max_memory_restart: '256M',
      
      // Process management
      merge_logs: true,
      time: true,
      
      // Railway-specific settings
      source_map_support: false,
      instance_var: 'INSTANCE_ID',
      
      // Error handling optimized for Railway
      exp_backoff_restart_delay: 50,
      
      // Process title
      process_title: 'announcement-scheduler-railway',
      
      // PM2 specific settings for containers
      pmx: false,
      vizion: false,
      
      // Use in-memory storage for PM2 in containers
      pm2_home: '/app/.pm2'
    }
  ]
};
