const fs = require('fs');
const path = require('path');

// Simple PNG resizing using canvas (if available) or fallback method
function resizeImage() {
  try {
    // Try to use canvas if available
    const { createCanvas, loadImage } = require('canvas');
    
    loadImage('public/ShoreAgents-Logo-only.png').then(image => {
      const canvas = createCanvas(256, 256);
      const ctx = canvas.getContext('2d');
      
      // Draw the image scaled to 256x256
      ctx.drawImage(image, 0, 0, 256, 256);
      
      // Save as PNG
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync('public/ShoreAgents-Logo-only-256.png', buffer);
      
      console.log('✅ Icon resized to 256x256 successfully!');
    }).catch(err => {
      console.log('Canvas not available, trying alternative method...');
      fallbackResize();
    });
  } catch (err) {
    console.log('Canvas not available, trying alternative method...');
    fallbackResize();
  }
}

function fallbackResize() {
  // Simple method: copy the original file and let electron-builder handle it
  // or create a simple 256x256 placeholder
  try {
    const originalBuffer = fs.readFileSync('public/ShoreAgents-Logo-only.png');
    fs.writeFileSync('public/ShoreAgents-Logo-only-256.png', originalBuffer);
    console.log('✅ Icon file copied (electron-builder will handle resizing)');
  } catch (err) {
    console.error('Error copying icon file:', err);
  }
}

resizeImage();
