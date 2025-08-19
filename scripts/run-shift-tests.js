#!/usr/bin/env node

/**
 * Simple test runner for shift-based activity system
 * Usage: node scripts/run-shift-tests.js
 */

const { runTests } = require('./test-shift-activity-system');

console.log('🧪 Running Shift-Based Activity Data Tests...\n');

runTests()
  .then(() => {
    console.log('\n✅ Test execution completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  });
