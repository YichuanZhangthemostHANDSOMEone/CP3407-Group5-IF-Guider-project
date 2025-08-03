const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const publicDir = path.join(__dirname, '..', 'public');

// Copy every generated bundle to the public directory
fs.readdirSync(distDir).forEach(file => {
  if (file.endsWith('.bundle.js')) {
    const src = path.join(distDir, file);
    const dest = path.join(publicDir, file);
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} to public`);
  }
});

