const fs = require('fs');

function getMap(f) {
    const lines = fs.readFileSync(f, 'utf-8').split('\n');
    let output = '';
    lines.forEach((l, i) => {
        const line = l.trim();
        if (
            line.match(/^(export\s+)?(const|function|let|class)\s+[A-Z]/i) ||
            line.startsWith('useEffect(') ||
            line.startsWith('//') ||
            line.startsWith('return (') ||
            line.startsWith('<div') ||
            line.startsWith('const handle')
        ) {
            output += `${i + 1}: ${line}\n`;
        }
    });
    return output;
}

const map1 = getMap('src/components/games/ClubsGame.tsx');
const map2 = getMap('src/components/games/ClubsGameMaster.tsx');

fs.writeFileSync('clubs_mindmap.md', `# ClubsGame.tsx Structure\n\n\`\`\`\n${map1}\n\`\`\`\n\n# ClubsGameMaster.tsx Structure\n\n\`\`\`\n${map2}\n\`\`\`\n`);
