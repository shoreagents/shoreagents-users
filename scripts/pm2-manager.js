#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class PM2Manager {
  constructor() {
    this.appName = 'shoreagents-socket-server';
    this.logDir = './logs';
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
      console.log(`📁 Created log directory: ${this.logDir}`);
    }
  }

  runCommand(command) {
    try {
      const output = execSync(command, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      return { success: true, output: output.trim() };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        output: error.stdout ? error.stdout.toString() : '',
        stderr: error.stderr ? error.stderr.toString() : ''
      };
    }
  }

  start() {
    console.log('🚀 Starting ShoreAgents Socket Server with PM2...');
    
    // Check if already running
    const status = this.status();
    if (status.running) {
      console.log('⚠️  Socket server is already running');
      return this.restart();
    }

    const result = this.runCommand('pm2 start ecosystem.config.js --env production');
    if (result.success) {
      console.log('✅ Socket server started successfully');
      this.showStatus();
    } else {
      console.error('❌ Failed to start socket server:', result.error);
      console.error('Output:', result.output);
      console.error('Stderr:', result.stderr);
    }
    return result;
  }

  stop() {
    console.log('🛑 Stopping ShoreAgents Socket Server...');
    const result = this.runCommand(`pm2 stop ${this.appName}`);
    if (result.success) {
      console.log('✅ Socket server stopped successfully');
    } else {
      console.error('❌ Failed to stop socket server:', result.error);
    }
    return result;
  }

  restart() {
    console.log('🔄 Restarting ShoreAgents Socket Server...');
    const result = this.runCommand(`pm2 restart ${this.appName}`);
    if (result.success) {
      console.log('✅ Socket server restarted successfully');
      this.showStatus();
    } else {
      console.error('❌ Failed to restart socket server:', result.error);
    }
    return result;
  }

  reload() {
    console.log('🔄 Reloading ShoreAgents Socket Server (zero-downtime)...');
    const result = this.runCommand(`pm2 reload ${this.appName}`);
    if (result.success) {
      console.log('✅ Socket server reloaded successfully');
      this.showStatus();
    } else {
      console.error('❌ Failed to reload socket server:', result.error);
    }
    return result;
  }

  status() {
    const result = this.runCommand(`pm2 jlist`);
    if (!result.success) {
      return { running: false, error: result.error };
    }

    try {
      const processes = JSON.parse(result.output);
      const app = processes.find(p => p.name === this.appName);
      
      if (!app) {
        return { running: false, error: 'App not found' };
      }

      return {
        running: app.pm2_env.status === 'online',
        status: app.pm2_env.status,
        uptime: app.pm2_env.uptime,
        memory: app.monit.memory,
        cpu: app.monit.cpu,
        pid: app.pid,
        restarts: app.pm2_env.restart_time
      };
    } catch (error) {
      return { running: false, error: 'Failed to parse PM2 status' };
    }
  }

  showStatus() {
    const status = this.status();
    if (status.running) {
      console.log('\n📊 Socket Server Status:');
      console.log(`   Status: ${status.status}`);
      console.log(`   PID: ${status.pid}`);
      console.log(`   Uptime: ${Math.floor(status.uptime / 1000)}s`);
      console.log(`   Memory: ${Math.round(status.memory / 1024 / 1024)}MB`);
      console.log(`   CPU: ${status.cpu}%`);
      console.log(`   Restarts: ${status.restarts}`);
    } else {
      console.log('❌ Socket server is not running');
      if (status.error) {
        console.log(`   Error: ${status.error}`);
      }
    }
  }

  logs(lines = 50) {
    console.log(`📋 Showing last ${lines} lines of socket server logs...`);
    const result = this.runCommand(`pm2 logs ${this.appName} --lines ${lines}`);
    if (result.success) {
      console.log(result.output);
    } else {
      console.error('❌ Failed to get logs:', result.error);
    }
    return result;
  }

  monitor() {
    console.log('📊 Opening PM2 monitoring dashboard...');
    const result = this.runCommand('pm2 monit');
    return result;
  }

  resetMetrics() {
    console.log('🔄 Resetting socket server metrics...');
    const result = this.runCommand('curl -X POST http://localhost:3004/reset-metrics');
    if (result.success) {
      console.log('✅ Metrics reset successfully');
      console.log('Response:', result.output);
    } else {
      console.error('❌ Failed to reset metrics:', result.error);
    }
    return result;
  }

  setupCron() {
    console.log('⏰ Setting up daily reset cron job...');
    
    const cronScript = `#!/bin/bash
# Daily reset for ShoreAgents Socket Server
# Runs at 2:00 AM daily

echo "$(date): Starting daily socket server reset" >> /var/log/shoreagents-socket-reset.log

# Reset metrics
curl -X POST http://localhost:3004/reset-metrics >> /var/log/shoreagents-socket-reset.log 2>&1

# Restart PM2 process
pm2 restart shoreagents-socket-server >> /var/log/shoreagents-socket-reset.log 2>&1

echo "$(date): Daily reset completed" >> /var/log/shoreagents-socket-reset.log
`;

    const cronFile = '/tmp/shoreagents-daily-reset.sh';
    fs.writeFileSync(cronFile, cronScript);
    
    // Make executable
    execSync(`chmod +x ${cronFile}`);
    
    console.log(`📝 Cron script created: ${cronFile}`);
    console.log('To add to crontab, run:');
    console.log(`echo "0 2 * * * ${cronFile}" | crontab -`);
    
    return cronFile;
  }

  cleanup() {
    console.log('🧹 Cleaning up PM2 processes and logs...');
    
    // Stop the app
    this.stop();
    
    // Delete PM2 process
    this.runCommand(`pm2 delete ${this.appName}`);
    
    // Clean old logs (keep last 7 days)
    const result = this.runCommand('pm2 flush');
    if (result.success) {
      console.log('✅ PM2 logs cleaned up');
    }
    
    console.log('✅ Cleanup completed');
  }
}

// CLI interface
const command = process.argv[2];
const manager = new PM2Manager();

switch (command) {
  case 'start':
    manager.start();
    break;
  case 'stop':
    manager.stop();
    break;
  case 'restart':
    manager.restart();
    break;
  case 'reload':
    manager.reload();
    break;
  case 'status':
    manager.showStatus();
    break;
  case 'logs':
    const lines = parseInt(process.argv[3]) || 50;
    manager.logs(lines);
    break;
  case 'monitor':
    manager.monitor();
    break;
  case 'reset-metrics':
    manager.resetMetrics();
    break;
  case 'setup-cron':
    manager.setupCron();
    break;
  case 'cleanup':
    manager.cleanup();
    break;
  default:
    console.log(`
ShoreAgents Socket Server PM2 Manager

Usage: node scripts/pm2-manager.js <command>

Commands:
  start          Start the socket server
  stop           Stop the socket server
  restart        Restart the socket server
  reload         Reload the socket server (zero-downtime)
  status         Show server status
  logs [lines]   Show server logs (default: 50 lines)
  monitor        Open PM2 monitoring dashboard
  reset-metrics  Reset connection metrics
  setup-cron     Setup daily reset cron job
  cleanup        Clean up PM2 processes and logs

Examples:
  node scripts/pm2-manager.js start
  node scripts/pm2-manager.js logs 100
  node scripts/pm2-manager.js status
    `);
}
