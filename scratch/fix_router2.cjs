const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');
code = code.replace('<AnimatePresence mode="sync">', '<AnimatePresence mode="wait">');
fs.writeFileSync('src/components/AdminDashboard.tsx', code);
console.log('Done!');
