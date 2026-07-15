const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

// Replace setShowEliminatedModal(false) with setShowEliminatedModal(null)
code = code.replaceAll('setShowEliminatedModal(false)', 'setShowEliminatedModal(null)');

// Now we need to fix the modal list generation.
// It currently uses:
// {Object.values(spadesGameStatus?.players || {}).filter((p: any) => !p.cards || p.cards.length === 0).length === 0 ? (
// ...
// {Object.values(spadesGameStatus?.players || {})
//     .filter((p: any) => !p.cards || p.cards.length === 0)
//     .map((p: any, idx) => (

// We will inject a helper function `getEliminatedPlayers()` and use it in the JSX.
const helperFn = `
    const getEliminatedPlayers = () => {
        if (!showEliminatedModal) return [];
        if (showEliminatedModal === 'spades') {
            return Object.values(spadesGameStatus?.players || {}).filter((p: any) => !p.cards || p.cards.length === 0);
        }
        if (showEliminatedModal === 'clubs') {
            return Object.values(clubsGameStatus?.players || {}).filter((p: any) => p.status === 'eliminated' || p.eliminated);
        }
        if (showEliminatedModal === 'diamonds') {
            return Object.values(diamondsGameStatus?.players || {}).filter((p: any) => p.status === 'eliminated' || p.eliminated || p.visa_points <= 0);
        }
        if (showEliminatedModal === 'hearts') {
            return Object.values(heartsGameStatus?.players || {}).filter((p: any) => p.status === 'eliminated' || p.eliminated || p.health <= 0);
        }
        return [];
    };
`;

// Insert helperFn right before the modal renders or inside the component top level.
// Let's insert it right above `// Listen for Spades Updates`
code = code.replace('    // Listen for Spades Updates', helperFn + '\n    // Listen for Spades Updates');

// Now replace the usages inside the modal.
code = code.replaceAll(
    'Object.values(spadesGameStatus?.players || {}).filter((p: any) => !p.cards || p.cards.length === 0)',
    'getEliminatedPlayers()'
);
code = code.replaceAll(
    'Object.values(spadesGameStatus?.players || {})\n                                                                                .filter((p: any) => !p.cards || p.cards.length === 0)',
    'getEliminatedPlayers()'
);

fs.writeFileSync('src/components/AdminDashboard.tsx', code);
console.log('Fixed modal logic');
