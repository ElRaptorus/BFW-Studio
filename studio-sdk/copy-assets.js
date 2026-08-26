const fs = require('fs');
const path = require('path');

function collectAssetFiles(directory, collected) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectAssetFiles(fullPath, collected);
    } else if (entry.name.endsWith('.scss') || entry.name.endsWith('.css')) {
      collected.push(fullPath);
    }
  }
}

const sourceRoot = path.join(__dirname, 'src');
const assetFiles = [];
collectAssetFiles(sourceRoot, assetFiles);

for (const sourceFile of assetFiles) {
  const relativePath = path.relative(sourceRoot, sourceFile);
  const destinationFile = path.join(__dirname, 'out', 'src', relativePath);
  fs.mkdirSync(path.dirname(destinationFile), { recursive: true });
  fs.copyFileSync(sourceFile, destinationFile);
}
