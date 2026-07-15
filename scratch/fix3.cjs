const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

const targetPoint1 = '                                </span>\r\n                            </div>';
const targetPoint2 = '                                        <stat.icon size={48} />';

const idx1 = code.indexOf(targetPoint1);
const idx2 = code.indexOf(targetPoint2);

if (idx1 !== -1 && idx2 !== -1) {
    const replacement = `                                </span>
                            </div>
                        )}
                        {/* Header Command Buttons */}
                        <div className="flex items-center flex-wrap justify-center sm:justify-end gap-1.5 sm:gap-2 ml-1 sm:ml-2 border-l border-white/10 pl-2 sm:pl-4 w-full sm:w-auto">
                            <span className="flex items-center gap-1.5 text-[8px] sm:text-[12px] lg:text-[13px] font-mono">
                                <span className={\`w-2 h-2 rounded-full animate-pulse \${networkPing === null ? 'bg-gray-500' :
                                    networkPing < 100 ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' :
                                        networkPing < 300 ? 'bg-yellow-500 shadow-[0_0_8px_#eab308]' :
                                            'bg-red-500 shadow-[0_0_8px_#ef4444]'
                                    }\`} />
                                {networkPing !== null ? \`\${networkPing}ms\` : '...'}
                            </span>

                            <button
                                onClick={() => navigate('/home')}
                                title="Back to Home"
                                className="flex items-center gap-1.5 px-2 sm:px-4 py-1 sm:py-2 bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500 hover:text-white rounded text-[9px] sm:text-[12px] font-bold uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                            >
                                <ArrowLeft size={11} className="sm:size-3" />
                                <span>BACK</span>
                            </button>
                        </div>
                    </div>
                </header>

                {activeView === 'dashboard' && (
                    <>
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                            {dashboardStats.map((stat, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="bg-black/40 border border-white/10 p-6 rounded-lg backdrop-blur-sm relative overflow-hidden group"
                                >
                                    <div className={\`absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity \${stat.color}\`}>
`;
    code = code.substring(0, idx1) + replacement + code.substring(idx2);
    fs.writeFileSync('src/components/AdminDashboard.tsx', code);
    console.log('Successfully restored header and stats grid!');
} else {
    console.log('Could not find injection points. idx1: ' + idx1 + ' idx2: ' + idx2);
    
    // Try finding without \r
    const targetPoint1_lf = '                                </span>\n                            </div>';
    const idx1_lf = code.indexOf(targetPoint1_lf);
    
    if (idx1_lf !== -1 && idx2 !== -1) {
        code = code.substring(0, idx1_lf) + replacement + code.substring(idx2);
        fs.writeFileSync('src/components/AdminDashboard.tsx', code);
        console.log('Successfully restored header and stats grid (LF)!');
    }
}
