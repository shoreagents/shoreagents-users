const fs = require('fs');
const path = require('path');

// Directory containing API routes
const apiDir = path.join(__dirname, '..', 'src', 'app', 'api');

// Patterns to clean up remaining pool references
const cleanupPatterns = [
  {
    // Remove pool variable declarations
    pattern: /let\s+pool:\s*Pool\s*\|\s*null\s*=\s*null\s*\n/g,
    replacement: ""
  },
  {
    // Remove pool = new Pool() lines
    pattern: /pool\s*=\s*new\s+Pool\([^)]*\)\s*\n/g,
    replacement: ""
  },
  {
    // Remove databaseConfig objects
    pattern: /const\s+databaseConfig\s*=\s*{[^}]*}\s*\n/g,
    replacement: ""
  },
  {
    // Remove pool.connect() and client.release() patterns
    pattern: /const\s+client\s*=\s*await\s+pool\.connect\(\)\s*\n\s*try\s*{([\s\S]*?)}\s*finally\s*{\s*client\.release\(\)\s*}\s*\n/g,
    replacement: (match, content) => {
      return content.trim() + '\n';
    }
  },
  {
    // Remove pool.end() calls
    pattern: /if\s*\(\s*pool\s*\)\s*{\s*await\s+pool\.end\(\)\s*}\s*\n/g,
    replacement: ""
  },
  {
    // Remove pool.end() in finally blocks
    pattern: /finally\s*{\s*if\s*\(\s*pool\s*\)\s*await\s+pool\.end\(\)\s*}\s*\n/g,
    replacement: ""
  },
  {
    // Remove pool.end() in catch blocks
    pattern: /catch\s*\([^)]*\)\s*{\s*[^}]*await\s+pool\.end\(\)[^}]*}\s*\n/g,
    replacement: (match) => {
      // Keep the catch block but remove pool.end()
      return match.replace(/await\s+pool\.end\(\)\s*;?\s*/g, '');
    }
  },
  {
    // Remove Pool import if it exists
    pattern: /import\s*{\s*Pool\s*}\s*from\s*['"]pg['"];?\s*\n/g,
    replacement: ""
  },
  {
    // Clean up extra empty lines
    pattern: /\n\s*\n\s*\n/g,
    replacement: "\n\n"
  }
];

function cleanupFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Apply cleanup patterns
    cleanupPatterns.forEach(({ pattern, replacement }) => {
      const newContent = content.replace(pattern, replacement);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Cleaned: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ Error cleaning ${filePath}:`, error.message);
    return false;
  }
}

function walkDirectory(dir) {
  const files = fs.readdirSync(dir);
  let cleanedCount = 0;

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      cleanedCount += walkDirectory(filePath);
    } else if (file.endsWith('.ts') && file === 'route.ts') {
      if (cleanupFile(filePath)) {
        cleanedCount++;
      }
    }
  });

  return cleanedCount;
}

// Run the cleanup
console.log('🔄 Cleaning up remaining pool references in API routes...');
const cleanedCount = walkDirectory(apiDir);
console.log(`✅ Cleaned ${cleanedCount} files`);
