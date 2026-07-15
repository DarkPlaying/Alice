const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

// 1. Move Modal OUT of Spades section
const modalStartStr = '{/* Eliminated Players Modal */}';
const modalEndStr = '</AnimatePresence>';

let startIdx = code.indexOf(modalStartStr);
let endIdx = code.indexOf(modalEndStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const modalBlock = code.substring(startIdx, endIdx + modalEndStr.length);
    code = code.substring(0, startIdx) + code.substring(endIdx + modalEndStr.length);
    
    // Inject at the end of the file, just before the last </div>
    const injectPoint = '{/* Global Settings Card */}';
    const injectIdx = code.indexOf(injectPoint);
    
    if (injectIdx !== -1) {
        code = code.substring(0, injectIdx) + modalBlock + '\n\n            ' + code.substring(injectIdx);
    }
}

// 2. Add ADMIN_SETTINGS back to sidebar
const adminSettingsButton = `
                {/* Admin Profile */}
                <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-white/10">
                    <button
                        onClick={() => setShowAdminCard(true)}
                        className="flex items-center justify-between gap-2 px-2 py-2 sm:px-3 sm:py-2 bg-white/5 border border-white/10 rounded text-[9px] sm:text-[12px] hover:bg-white/10 transition-all cursor-pointer"
                    >
                        <span className="text-white font-bold">{adminSettings?.username?.toUpperCase() || 'ADMIN_SETTINGS'}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    </button>
                </div>
            </aside>`;

code = code.replace('            </aside>', adminSettingsButton);

// 3. Increase height of round monitor items
code = code.replace(
    /className=\{\`bg-white\/5 border rounded-lg p-3 transition-all group flex-1 flex flex-col justify-center gap-2/g,
    'className={`bg-white/5 border rounded-lg p-5 min-h-[95px] transition-all group flex-1 flex flex-col justify-center gap-2'
);

fs.writeFileSync('src/components/AdminDashboard.tsx', code);
console.log('Done fixing modal placement, sidebar button, and round height.');
