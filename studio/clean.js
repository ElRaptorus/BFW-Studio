const fs = require('fs');
const path = require('path');

fs.rmSync(path.join(__dirname, 'out'), { recursive: true, force: true });
