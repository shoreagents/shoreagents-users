const fs = require('fs');
const path = require('path');

// Check PNG dimensions and create proper 256x256 version
function checkAndFixIcon() {
  try {
    console.log('Checking and fixing icon files...');
    
    const originalPngPath = path.join(__dirname, 'public', 'ShoreAgents-Logo-only.png');
    const targetPngPath = path.join(__dirname, 'public', 'ShoreAgents-Logo-only-256.png');
    
    if (!fs.existsSync(originalPngPath)) {
      console.error('Original PNG file not found:', originalPngPath);
      return;
    }
    
    // Read the PNG file
    const pngBuffer = fs.readFileSync(originalPngPath);
    
    // Check PNG header to get dimensions
    // PNG files have a specific header structure
    if (pngBuffer.length < 24) {
      console.error('PNG file is too small to be valid');
      return;
    }
    
    // PNG signature check
    const pngSignature = pngBuffer.slice(0, 8);
    const expectedSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    
    if (!pngSignature.equals(expectedSignature)) {
      console.error('File is not a valid PNG');
      return;
    }
    
    // Read IHDR chunk to get dimensions
    // IHDR chunk starts at byte 8
    const ihdrStart = 8;
    const width = pngBuffer.readUInt32BE(ihdrStart + 8);
    const height = pngBuffer.readUInt32BE(ihdrStart + 12);
    
    console.log(`Original PNG dimensions: ${width}x${height}`);
    
    if (width === 256 && height === 256) {
      console.log('✅ PNG is already 256x256, copying to target file...');
      fs.copyFileSync(originalPngPath, targetPngPath);
    } else {
      console.log(`⚠️  PNG is ${width}x${height}, not 256x256`);
      console.log('For now, copying anyway - electron-builder should handle resizing');
      fs.copyFileSync(originalPngPath, targetPngPath);
    }
    
    // Also create a proper ICO file using a different approach
    // Let's try using the favicon.ico as a base and modify it
    const faviconPath = path.join(__dirname, 'src', 'app', 'favicon.ico');
    const icoPath = path.join(__dirname, 'public', 'ShoreAgents-Logo-only.ico');
    
    if (fs.existsSync(faviconPath)) {
      console.log('Found favicon.ico, copying as fallback...');
      fs.copyFileSync(faviconPath, icoPath);
    } else {
      console.log('No favicon.ico found, creating minimal ICO...');
      // Create a minimal ICO file
      createMinimalIco(icoPath);
    }
    
    console.log('✅ Icon files prepared');
    console.log('📝 Next steps:');
    console.log('1. Make sure the PNG is exactly 256x256 pixels');
    console.log('2. Try building again with: npm run dist');
    console.log('3. If still not working, we may need to use an online PNG to ICO converter');
    
  } catch (error) {
    console.error('Error checking/fixing icons:', error);
  }
}

function createMinimalIco(icoPath) {
  // Create a minimal 16x16 ICO file
  const icoData = Buffer.from([
    // ICO header
    0x00, 0x00, // Reserved
    0x01, 0x00, // Type (icon)
    0x01, 0x00, // Number of images
    0x10, 0x10, // Width (16)
    0x10, 0x10, // Height (16)
    0x00, 0x00, // Color count
    0x00, 0x00, // Reserved
    0x01, 0x00, // Color planes
    0x20, 0x00, // Bits per pixel
    0x00, 0x01, 0x00, 0x00, // Size of image data
    0x16, 0x00, 0x00, 0x00, // Offset to image data
    
    // Minimal 16x16 32-bit RGBA image data (256 bytes)
    // This creates a simple blue square
    ...Array(256).fill(0).map((_, i) => {
      const x = i % 16;
      const y = Math.floor(i / 16);
      const pixel = (y * 16 + x) * 4;
      return [
        0x00, 0x00, 0xFF, 0xFF // Blue pixel with full alpha
      ];
    }).flat()
  ]);
  
  fs.writeFileSync(icoPath, icoData);
  console.log('Created minimal ICO file');
}

checkAndFixIcon();



