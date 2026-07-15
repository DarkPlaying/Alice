const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

// 1. System Logs (remove interval and dummy data)
code = code.replace(/const \[systemLogs, setSystemLogs\] = useState<string\[\]>\(\[[\s\S]*?\]\);/, 'const [systemLogs, setSystemLogs] = useState<string[]>([]);');
code = code.replace(/useEffect\(\(\) => \{\s*if \(\!players \|\| players\.length === 0\) return;[\s\S]*?return \(\) => clearInterval\(interval\);\s*\}, \[players\]\);/, '');

// 2. Add missing search queries
code = code.replace(/const \[spadesMessages, setSpadesMessages\] = useState<any\[\]>\(\[\]\);/, 'const [spadesMessages, setSpadesMessages] = useState<any[]>([]);\n    const [spadesSearchQuery, setSpadesSearchQuery] = useState(\'\');');
code = code.replace(/const \[diamondsMessages, setDiamondsMessages\] = useState<any\[\]>\(\[\]\);/, 'const [diamondsMessages, setDiamondsMessages] = useState<any[]>([]);\n    const [diamondsSearchQuery, setDiamondsSearchQuery] = useState(\'\');');

// 3. Fix showEliminatedModal state
code = code.replace(/const \[showEliminatedModal, setShowEliminatedModal\] = useState\(false\);/, 'const [showEliminatedModal, setShowEliminatedModal] = useState<string | null>(null);');

// 4. Update the 4 ELIMINATED buttons
function replaceElim(suitName, beforeText) {
    const idx = code.indexOf(beforeText);
    if (idx !== -1) {
        const sub = code.substring(idx, idx + 1000);
        const replaced = sub.replace('setShowEliminatedModal(true)', `setShowEliminatedModal('${suitName}')`);
        code = code.substring(0, idx) + replaced + code.substring(idx + 1000);
    }
}

replaceElim('clubs', "clubsGameStatus.is_paused ? 'RESUME' : 'HALT'");
replaceElim('spades', "spadesGameStatus.is_paused ? 'RESUME' : 'HALT'");
replaceElim('diamonds', "diamondsGameStatus.is_paused ? 'RESUME' : 'HALT'");
replaceElim('hearts', "heartsGameStatus.is_paused ? 'RESUME' : 'HALT'");

// 5. Update COM INTELLIGENCE
code = code.replaceAll("suit.id === 'clubs' ? clubsMessages : heartsMessages", "suit.id === 'clubs' ? clubsMessages : suit.id === 'hearts' ? heartsMessages : suit.id === 'spades' ? spadesMessages : diamondsMessages");
code = code.replaceAll("suit.id === 'clubs' ? clubsSearchQuery : heartsSearchQuery", "suit.id === 'clubs' ? clubsSearchQuery : suit.id === 'hearts' ? heartsSearchQuery : suit.id === 'spades' ? spadesSearchQuery : diamondsSearchQuery");
code = code.replaceAll("suit.id === 'clubs' ? setClubsSearchQuery(e.target.value) : setHeartsSearchQuery(e.target.value)", "suit.id === 'clubs' ? setClubsSearchQuery(e.target.value) : suit.id === 'hearts' ? setHeartsSearchQuery(e.target.value) : suit.id === 'spades' ? setSpadesSearchQuery(e.target.value) : setDiamondsSearchQuery(e.target.value)");

// 6. Round monitor boxes flex-1
code = code.replace(/className=\{\`bg-white\/5 border rounded-lg p-3 transition-all group flex flex-col gap-2/g, 'className={`bg-white/5 border rounded-lg p-3 transition-all group flex-1 flex flex-col justify-center gap-2');

// 7. Clubs Joker reset icon
code = code.replace(/<RotateCcw size=\{8\} className="sm:size-\[10px\] lg:size-\[12px\]" \/> FORCE RESET GAME/, '<img src="/joker.png" className="w-2 sm:w-[10px] lg:w-[12px] opacity-60" alt="Joker" /> FORCE RESET GAME');

fs.writeFileSync('src/components/AdminDashboard.tsx', code);
