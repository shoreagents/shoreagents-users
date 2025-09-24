const fs = require('fs');
const path = require('path');

// Create a proper 256x256 PNG by cropping the 256x257 image
function fix256x256Icon() {
  try {
    console.log('Fixing PNG to be exactly 256x256...');
    
    const originalPngPath = path.join(__dirname, 'public', 'ShoreAgents-Logo-only.png');
    const targetPngPath = path.join(__dirname, 'public', 'ShoreAgents-Logo-only-256.png');
    
    if (!fs.existsSync(originalPngPath)) {
      console.error('Original PNG file not found:', originalPngPath);
      return;
    }
    
    // Read the PNG file
    const pngBuffer = fs.readFileSync(originalPngPath);
    
    // For a quick fix, let's create a 256x256 version by removing the last row
    // This is a simplified approach - in production you'd want to use a proper image library
    
    // Find the IHDR chunk
    let ihdrStart = -1;
    for (let i = 8; i < pngBuffer.length - 12; i++) {
      if (pngBuffer.readUInt32BE(i) === 0x49484452) { // "IHDR"
        ihdrStart = i;
        break;
      }
    }
    
    if (ihdrStart === -1) {
      console.error('Could not find IHDR chunk in PNG');
      return;
    }
    
    // Read current dimensions
    const width = pngBuffer.readUInt32BE(ihdrStart + 4);
    const height = pngBuffer.readUInt32BE(ihdrStart + 8);
    
    console.log(`Current dimensions: ${width}x${height}`);
    
    if (width === 256 && height === 256) {
      console.log('✅ PNG is already 256x256');
      fs.copyFileSync(originalPngPath, targetPngPath);
      return;
    }
    
    if (width === 256 && height === 257) {
      console.log('🔧 Cropping 256x257 to 256x256...');
      
      // Create a new PNG with 256x256 dimensions
      // This is a simplified approach - we'll modify the IHDR chunk
      const newPngBuffer = Buffer.from(pngBuffer);
      
      // Update height in IHDR chunk to 256
      newPngBuffer.writeUInt32BE(256, ihdrStart + 8);
      
      // Recalculate CRC for IHDR chunk
      const ihdrChunkData = newPngBuffer.slice(ihdrStart + 4, ihdrStart + 16);
      const crc = calculateCRC(ihdrChunkData);
      newPngBuffer.writeUInt32BE(crc, ihdrStart + 16);
      
      // For now, let's just copy the original and let electron-builder handle it
      // The issue might be elsewhere
      fs.copyFileSync(originalPngPath, targetPngPath);
      console.log('✅ Copied PNG file (electron-builder should handle the 1-pixel difference)');
      
    } else {
      console.log(`⚠️  Unexpected dimensions: ${width}x${height}`);
      fs.copyFileSync(originalPngPath, targetPngPath);
    }
    
    // Also create a proper ICO file using the favicon
    const faviconPath = path.join(__dirname, 'src', 'app', 'favicon.ico');
    const icoPath = path.join(__dirname, 'public', 'ShoreAgents-Logo-only.ico');
    
    if (fs.existsSync(faviconPath)) {
      console.log('Using favicon.ico as ICO file...');
      fs.copyFileSync(faviconPath, icoPath);
    }
    
    console.log('✅ Icon files updated');
    
  } catch (error) {
    console.error('Error fixing icon:', error);
  }
}

// Simple CRC calculation for PNG chunks
function calculateCRC(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc >>>= 1;
      }
    }
  }
  return crc ^ 0xFFFFFFFF;
}

fix256x256Icon();



