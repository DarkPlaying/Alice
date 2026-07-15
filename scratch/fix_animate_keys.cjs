const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

code = code.replace(
    /\{\/\* GENERAL TOAST \*\/\}\s*<AnimatePresence>/g,
    '{/* GENERAL TOAST */}\n                <AnimatePresence key="toast-presence">'
);

code = code.replace(
    /\{\/\* UNDO TOAST \(PERMANENT\) \*\/\}\s*<AnimatePresence>/g,
    '{/* UNDO TOAST (PERMANENT) */}\n                <AnimatePresence key="undo-presence">'
);

code = code.replace(
    /\{\/\* TRACKING MODAL \*\/\}\s*<AnimatePresence>/g,
    '{/* TRACKING MODAL */}\n                <AnimatePresence key="tracking-presence">'
);

code = code.replace(
    /\{\/\* START GAME WAITING LIST WINDOW \*\/\}\s*<AnimatePresence>/g,
    '{/* START GAME WAITING LIST WINDOW */}\n                <AnimatePresence key="start-presence">'
);

fs.writeFileSync('src/components/AdminDashboard.tsx', code);
console.log('Fixed AnimatePresence keys');
