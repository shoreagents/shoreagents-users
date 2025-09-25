#!/usr/bin/env node

/**
 * Cleanup script to remove temp badge and tray icon files
 * These are no longer needed since we now use in-memory images
 */

const fs = require('fs');
const path = require('path');

const tempDir = path.join(__dirname, '../temp');

function cleanupTempFiles() {
  try {
    if (!fs.existsSync(tempDir)) {
      console.log('Temp directory does not exist, nothing to clean up.');
      return;
    }

    const files = fs.readdirSync(tempDir);
    let removedCount = 0;

    files.forEach(file => {
      // Remove badge and tray icon files
      if (file.startsWith('badge-') || file.startsWith('tray-icon-') || file === 'red-dot.png') {
        const filePath = path.join(tempDir, file);
        try {
          fs.unlinkSync(filePath);
          removedCount++;
          console.log(`Removed: ${file}`);
        } catch (error) {
          console.error(`Error removing ${file}:`, error.message);
        }
      }
    });

    console.log(`\nCleanup complete! Removed ${removedCount} temp files.`);
    console.log('Badge and tray icons now use in-memory images - no more temp files!');
    
  } catch (error) {
    console.error('Error during cleanup:', error.message);
  }
}

// Run cleanup
cleanupTempFiles();



