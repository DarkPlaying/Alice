const fs = require('fs');
const files = [
  'src/components/games/SpadesGameMaster.tsx',
  'src/components/games/SpadesGame.tsx',
  'src/components/games/HeartsGameMaster.tsx',
  'src/components/games/HeartsGame.tsx',
  'src/components/AdminDashboard.tsx'
];

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let content = fs.readFileSync(f, 'utf8');
  
  // The regex pattern matches: if (!VAR.endsWith('Z') && !VAR.match(/[+-]\d{2}:?\d{2}$/)) VAR += 'Z';
  // We want to prepend: if (VAR.match(/[+-]\d{2}$/)) VAR += ':00';
  const regex = /if \(\!([a-zA-Z0-9_]+)\.endsWith\('Z'\) && \!\1\.match\(\/\[\+-\]\\d\{2\}:\?\\d\{2\}\$\/\)\) \1 \+= 'Z';/g;
  
  content = content.replace(regex, (match, v) => {
      return `if (${v}.match(/[+-]\\d{2}$/)) ${v} += ':00';\n${match.replace(/^(\s*)/, '$1')}`;
  });
  
  // Wait, the indent will just be whatever it was. Actually, to keep indent perfect:
  // We can just match the leading whitespace too!
  const regex2 = /^(\s*)if \(\!([a-zA-Z0-9_]+)\.endsWith\('Z'\) && \!\2\.match\(\/\[\+-\]\\d\{2\}:\?\\d\{2\}\$\/\)\) \2 \+= 'Z';/gm;
  // Reset content to try regex2
  content = fs.readFileSync(f, 'utf8');
  content = content.replace(regex2, (match, space, v) => {
      return `${space}if (${v}.match(/[+-]\\d{2}$/)) ${v} += ':00';\n${match}`;
  });

  fs.writeFileSync(f, content);
  console.log('Fixed', f);
});
