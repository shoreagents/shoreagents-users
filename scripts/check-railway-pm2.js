#!/usr/bin/env node

const { execSync } = require('child_process');

class RailwayPM2Checker {
  constructor() {
    this.appName = 'shoreagents-socket-server';
  }

  runCommand(command) {
    try {
      console.log(`🔍 Running: ${command}`);
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

  checkPM2Status() {
    console.log('📊 Checking PM2 Status on Railway...\n');
    
    const result = this.runCommand('railway run pm2 status');
    if (result.success) {
      console.log('✅ PM2 Status:');
      console.log(result.output);
    } else {
      console.error('❌ Failed to get PM2 status:', result.error);
      console.error('Output:', result.output);
      console.error('Stderr:', result.stderr);
    }
    return result;
  }

  checkPM2Logs(lines = 20) {
    console.log(`📋 Checking PM2 Logs (last ${lines} lines)...\n`);
    
    const result = this.runCommand(`railway run pm2 logs ${this.appName} --lines ${lines}`);
    if (result.success) {
      console.log('✅ PM2 Logs:');
      console.log(result.output);
    } else {
      console.error('❌ Failed to get PM2 logs:', result.error);
    }
    return result;
  }

  checkHealth() {
    console.log('🏥 Checking Health Endpoint...\n');
    
    const result = this.runCommand('railway run curl -s http://localhost:3004/health');
    if (result.success) {
      try {
        const health = JSON.parse(result.output);
        console.log('✅ Health Status:');
        console.log(JSON.stringify(health, null, 2));
      } catch (e) {
        console.log('✅ Health Response (raw):');
        console.log(result.output);
      }
    } else {
      console.error('❌ Failed to check health:', result.error);
    }
    return result;
  }

  checkMetrics() {
    console.log('📈 Checking Metrics...\n');
    
    const result = this.runCommand('railway run curl -s http://localhost:3004/metrics');
    if (result.success) {
      try {
        const metrics = JSON.parse(result.output);
        console.log('✅ Metrics:');
        console.log(JSON.stringify(metrics, null, 2));
      } catch (e) {
        console.log('✅ Metrics Response (raw):');
        console.log(result.output);
      }
    } else {
      console.error('❌ Failed to check metrics:', result.error);
    }
    return result;
  }

  restartPM2() {
    console.log('🔄 Restarting PM2 Process...\n');
    
    const result = this.runCommand(`railway run pm2 restart ${this.appName}`);
    if (result.success) {
      console.log('✅ PM2 Restarted Successfully:');
      console.log(result.output);
    } else {
      console.error('❌ Failed to restart PM2:', result.error);
    }
    return result;
  }

  showPM2Info() {
    console.log('ℹ️  PM2 Process Information...\n');
    
    const result = this.runCommand(`railway run pm2 show ${this.appName}`);
    if (result.success) {
      console.log('✅ PM2 Process Info:');
      console.log(result.output);
    } else {
      console.error('❌ Failed to get PM2 info:', result.error);
    }
    return result;
  }

  checkAll() {
    console.log('🚀 Railway PM2 Health Check\n');
    console.log('=' .repeat(50));
    
    this.checkPM2Status();
    console.log('\n' + '=' .repeat(50));
    
    this.checkHealth();
    console.log('\n' + '=' .repeat(50));
    
    this.checkMetrics();
    console.log('\n' + '=' .repeat(50));
    
    this.checkPM2Logs(10);
    console.log('\n' + '=' .repeat(50));
    
    console.log('✅ Health check completed!');
  }
}

// CLI interface
const command = process.argv[2];
const checker = new RailwayPM2Checker();

switch (command) {
  case 'status':
    checker.checkPM2Status();
    break;
  case 'logs':
    const lines = parseInt(process.argv[3]) || 20;
    checker.checkPM2Logs(lines);
    break;
  case 'health':
    checker.checkHealth();
    break;
  case 'metrics':
    checker.checkMetrics();
    break;
  case 'restart':
    checker.restartPM2();
    break;
  case 'info':
    checker.showPM2Info();
    break;
  case 'all':
  default:
    checker.checkAll();
    break;
}
