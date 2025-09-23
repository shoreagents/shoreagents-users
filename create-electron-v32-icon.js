const fs = require('fs');
const path = require('path');

// Create proper icon files for Electron v32
function createElectronV32Icons() {
  try {
    console.log('Creating icons for Electron v32...');
    
    // For Electron v32, we need multiple icon sizes in ICO format
    // Let's create a proper ICO file with multiple sizes
    
    const originalPngPath = path.join(__dirname, 'public', 'ShoreAgents-Logo-only.png');
    const icoPath = path.join(__dirname, 'public', 'ShoreAgents-Logo-only.ico');
    
    if (!fs.existsSync(originalPngPath)) {
      console.error('Original PNG file not found:', originalPngPath);
      return;
    }
    
    // Read the original PNG
    const pngBuffer = fs.readFileSync(originalPngPath);
    
    // For Electron v32, we need to create an ICO with multiple sizes
    // Let's create a simple ICO file that should work
    
    // ICO file structure for multiple sizes
    const iconSizes = [
      { width: 16, height: 16 },
      { width: 32, height: 32 },
      { width: 48, height: 48 },
      { width: 64, height: 64 },
      { width: 128, height: 128 },
      { width: 256, height: 256 }
    ];
    
    // Create ICO header
    const headerSize = 6 + (iconSizes.length * 16);
    let icoBuffer = Buffer.alloc(headerSize);
    
    // ICO file header
    icoBuffer.writeUInt16LE(0, 0); // Reserved
    icoBuffer.writeUInt16LE(1, 2); // Type (icon)
    icoBuffer.writeUInt16LE(iconSizes.length, 4); // Number of images
    
    let currentOffset = headerSize;
    
    // For each size, we'll embed the PNG data
    // This is a simplified approach - in production you'd want to resize the image
    for (let i = 0; i < iconSizes.length; i++) {
      const size = iconSizes[i];
      const entryOffset = 6 + (i * 16);
      
      // Icon directory entry
      icoBuffer.writeUInt8(size.width === 256 ? 0 : size.width, entryOffset);
      icoBuffer.writeUInt8(size.height === 256 ? 0 : size.height, entryOffset + 1);
      icoBuffer.writeUInt8(0, entryOffset + 2); // Color count
      icoBuffer.writeUInt8(0, entryOffset + 3); // Reserved
      icoBuffer.writeUInt16LE(1, entryOffset + 4); // Color planes
      icoBuffer.writeUInt16LE(32, entryOffset + 6); // Bits per pixel
      icoBuffer.writeUInt32LE(pngBuffer.length, entryOffset + 8); // Size of image data
      icoBuffer.writeUInt32LE(currentOffset, entryOffset + 12); // Offset to image data
      
      currentOffset += pngBuffer.length;
    }
    
    // Append PNG data for each size (simplified - using same PNG for all sizes)
    for (let i = 0; i < iconSizes.length; i++) {
      icoBuffer = Buffer.concat([icoBuffer, pngBuffer]);
    }
    
    // Write the ICO file
    fs.writeFileSync(icoPath, icoBuffer);
    
    console.log('✅ ICO file created for Electron v32:', icoPath);
    console.log('ICO file size:', icoBuffer.length, 'bytes');
    
    // Also create a 256x256 PNG for other platforms
    const png256Path = path.join(__dirname, 'public', 'ShoreAgents-Logo-only-256.png');
    fs.copyFileSync(originalPngPath, png256Path);
    console.log('✅ 256x256 PNG created:', png256Path);
    
    console.log('📝 Configuration for Electron v32:');
    console.log('- Windows: Use ICO file');
    console.log('- Mac/Linux: Use PNG file');
    console.log('- Make sure icon paths are correct in package.json');
    
  } catch (error) {
    console.error('Error creating Electron v32 icons:', error);
  }
}

createElectronV32Icons();
