module.exports = {
  apps: [
    {
      name: 'break-reminder-scheduler',
      script: 'scripts/break-reminder-scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      
      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      
      // Restart policies
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Environment variables
      env: {
        NODE_ENV: 'production'
      },
      env_development: {
        NODE_ENV: 'development'
      },
      
      // Logging configuration
      log_file: './logs/break-reminder-scheduler-combined.log',
      out_file: './logs/break-reminder-scheduler-out.log',
      error_file: './logs/break-reminder-scheduler-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      merge_logs: true,
      time: true,
      
      // Error handling
      exp_backoff_restart_delay: 100,
      
      // Process title
      process_title: 'break-reminder-scheduler'
    },
    {
      name: 'task-notification-scheduler',
      script: 'scripts/task-notification-scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      
      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      
      // Restart policies
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Environment variables
      env: {
        NODE_ENV: 'production'
      },
      env_development: {
        NODE_ENV: 'development'
      },
      
      // Logging configuration
      log_file: './logs/task-notification-scheduler-combined.log',
      out_file: './logs/task-notification-scheduler-out.log',
      error_file: './logs/task-notification-scheduler-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      merge_logs: true,
      time: true,
      
      // Error handling
      exp_backoff_restart_delay: 100,
      
      // Process title
      process_title: 'task-notification-scheduler'
    },
    {
      name: 'meeting-scheduler',
      script: 'scripts/meeting-scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      
      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      
      // Restart policies
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Environment variables
      env: {
        NODE_ENV: 'production'
      },
      env_development: {
        NODE_ENV: 'development'
      },
      
      // Logging configuration
      log_file: './logs/meeting-scheduler-combined.log',
      out_file: './logs/meeting-scheduler-out.log',
      error_file: './logs/meeting-scheduler-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      merge_logs: true,
      time: true,
      
      // Error handling
      exp_backoff_restart_delay: 100,
      
      // Process title
      process_title: 'meeting-scheduler'
    },
    {
      name: 'event-reminder-scheduler',
      script: 'scripts/event-reminder-scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      
      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      
      // Restart policies
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Environment variables
      env: {
        NODE_ENV: 'production'
      },
      env_development: {
        NODE_ENV: 'development'
      },
      
      // Logging configuration
      log_file: './logs/event-reminder-scheduler-combined.log',
      out_file: './logs/event-reminder-scheduler-out.log',
      error_file: './logs/event-reminder-scheduler-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      merge_logs: true,
      time: true,
      
      // Error handling
      exp_backoff_restart_delay: 100,
      
      // Process title
      process_title: 'event-reminder-scheduler'
    },
    {
      name: 'announcement-scheduler',
      script: 'scripts/announcement-scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      
      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      
      // Restart policies
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Environment variables
      env: {
        NODE_ENV: 'production'
      },
      env_development: {
        NODE_ENV: 'development'
      },
      
      // Logging configuration
      log_file: './logs/announcement-scheduler-combined.log',
      out_file: './logs/announcement-scheduler-out.log',
      error_file: './logs/announcement-scheduler-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      merge_logs: true,
      time: true,
      
      // Error handling
      exp_backoff_restart_delay: 100,
      
      // Process title
      process_title: 'announcement-scheduler'
    }
  ]
};
