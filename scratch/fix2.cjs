const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

const targetStr = `                            <button
                                onClick={() => navigate('/home')}
                                title="Back to Home"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}`;

const fixStr = `                            <button
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
                                    animate={{ opacity: 1, y: 0 }}`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, fixStr);
    fs.writeFileSync('src/components/AdminDashboard.tsx', code);
    console.log('Fixed syntax error from bad replace');
} else {
    console.log('Could not find targetStr');
}
