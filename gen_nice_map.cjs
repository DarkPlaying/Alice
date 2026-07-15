const fs = require('fs');

function generateMap(filePath, title) {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    let map = `## ${title}\n\n`;
    
    let sections = {
        imports: [],
        state: [],
        effects: [],
        functions: [],
        render: []
    };

    lines.forEach((l, i) => {
        const line = l.trim();
        const num = i + 1;
        if (line.startsWith('import ')) {
            if (sections.imports.length === 0) sections.imports.push(`- L${num}: Imports block starts`);
        } else if (line.startsWith('const [') && line.includes('useState')) {
            sections.state.push(`- L${num}: \`${line}\``);
        } else if (line.startsWith('const ') && line.includes('useRef')) {
            sections.state.push(`- L${num}: \`${line}\``);
        } else if (line.startsWith('useEffect(')) {
            sections.effects.push(`- L${num}: \`useEffect\` block starts`);
        } else if (line.match(/^(export\s+)?(const|function)\s+[A-Za-z0-9_]+\s*=?\s*(\(.*\)|async)/)) {
            if (!line.includes('useState') && !line.includes('useRef') && !line.includes('useEffect')) {
                sections.functions.push(`- L${num}: \`${line}\``);
            }
        } else if (line.startsWith('return (')) {
            sections.render.push(`- L${num}: JSX Render block starts`);
        } else if (line.startsWith('//') && line.toUpperCase() === line && line.length > 10) {
            sections.functions.push(`- **L${num}: ${line}**`);
        }
    });

    map += `### State & Refs\n${sections.state.join('\n')}\n\n`;
    map += `### Lifecycle & Subscriptions\n${sections.effects.join('\n')}\n\n`;
    map += `### Functions & Logic\n${sections.functions.join('\n')}\n\n`;
    map += `### UI & Render\n${sections.render.join('\n')}\n\n`;
    
    return map;
}

const pMap = generateMap('src/components/games/ClubsGame.tsx', 'ClubsGame.tsx (Player File)');
const mMap = generateMap('src/components/games/ClubsGameMaster.tsx', 'ClubsGameMaster.tsx (Master File)');

const content = `# Code Architecture Mindmap\n\nThis document provides a line-by-line breakdown of the structure of the Player and Master files to help you navigate and edit them faster.\n\n${pMap}\n---\n\n${mMap}`;

const artifactDir = 'C:/Users/Sanjay/.gemini/antigravity-ide/brain/8ad14159-88a7-4104-b120-f24628a736e6';
fs.writeFileSync(`${artifactDir}/clubs_mindmap.md`, content);
console.log("Successfully generated mindmap.");
