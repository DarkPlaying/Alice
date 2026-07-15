const fs = require('fs');
const path = require('path');

const fullPath = path.join(__dirname, '../src/components/AdminDashboard.tsx');
let content = fs.readFileSync(fullPath, 'utf8');

// 1. handleKickPlayer (Line 324)
content = content.replace(
    /await updateDoc\(doc\(db, "users", userId\), \{[\s\n]*waiting_for_game: null[\s\n]*\}\);/g,
    `await supabase.from('profiles').update({ waiting_for_game: null }).eq('id', userId);`
);

// 2. clearAllWaitlist (Line 348)
const clearAllWaitlistRegex = /const q = query\(collection\(db, "users"\), where\("waiting_for_game", "!=", null\)\);[\s\S]*?await batch\.commit\(\);/m;
const newClearAllWaitlist = `const { data, error } = await supabase.from('profiles').update({ waiting_for_game: null }).neq('waiting_for_game', null);
            if (error) throw error;`;
content = content.replace(clearAllWaitlistRegex, newClearAllWaitlist);

// 3. handleBulkDelete (Line 675)
const bulkDeleteRegex = /const batch = writeBatch\(db\);[\s\S]*?await batch\.commit\(\);/m;
const newBulkDelete = `const { error } = await supabase.from('profiles').delete().in('id', safeIds);
            if (error) throw error;`;
content = content.replace(bulkDeleteRegex, newBulkDelete);

// 4. handleUndo (Line 697)
const undoRegex = /const batch = writeBatch\(db\);[\s\S]*?await batch\.commit\(\);\n\s*\}/m;
const newUndo = `if (lastActionType === 'delete') {
                const { error } = await supabase.from('profiles').insert(deletedBackup);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('profiles').delete().in('id', deletedBackup.map(u => u.id));
                if (error) throw error;
            }`;
content = content.replace(undoRegex, newUndo);

// 5. handleFileUpload (Line 730)
const uploadRegex = /\/\/ Initialize Secondary App once for the batch[\s\S]*?createdPlayersTmp\.push\(\{ id: userCredential\.user\.uid \}\);\n\s*successCount\+\+;/m;
const newUpload = `
                // Call Supabase Edge Function or loop (Looping here since edge function not available)
                for (let i = 0; i < users.length; i++) {
                    const user = users[i];
                    try {
                        if (!user.username || !user.password) continue;
                        const email = user.username.includes('@') ? user.username : \`\${user.username}@borderland.com\`;
                        
                        const { data, error } = await supabase.auth.signUp({
                            email,
                            password: user.password,
                        });
                        if (error) throw error;
                        
                        createdPlayersTmp.push({ id: data.user?.id });
                        successCount++;
                    }
`;
// Wait, I need to match the try block properly.
content = content.replace(
    /\/\/ Initialize Secondary App once for the batch[\s\S]*?successCount\+\+;/m,
    `
                const createdPlayersTmp: any[] = [];
                let successCount = 0;
                let failCount = 0;
                for (let i = 0; i < users.length; i++) {
                    const user = users[i];
                    try {
                        if (!user.username || !user.password) continue;
                        const email = user.username.includes('@') ? user.username : \`\${user.username}@borderland.com\`;
                        
                        const { data, error } = await supabase.auth.signUp({
                            email,
                            password: user.password,
                        });
                        if (error) throw error;

                        await supabase.from('profiles').update({
                            username: user.username.split('@')[0],
                            role: activeView === 'masters' ? 'master' : 'player',
                            status: 'alive',
                            visa_points: 500
                        }).eq('id', data.user?.id);
                        
                        createdPlayersTmp.push({ id: data.user?.id });
                        successCount++;`
);

// 6. handleStartHearts (Line 2144)
content = content.replace(
    /try \{\n\s*const gameRef = doc\(db, 'games', 'hearts_main'\);\n\s*await updateDoc\(gameRef, updatePayload\);\n\s*\} catch \(e\) \{\n\s*console\.warn\("Firestore sync failed \(Permissions\)"\);\n\s*\}/g,
    `// Sync handled by Supabase above`
);

// 7. updateSuitMasterState (Line 2636)
const setDocRegex = /await setDoc\(doc\(db, 'active_games', suitKey\), \{[\s\S]*?\}, \{ merge: true \}\);/m;
content = content.replace(setDocRegex, `await supabase.from(suit === 'spades' ? 'spades_game_status' : 'clubs_game_status').update({ allowed_players: allowedIds }).eq('id', suitKey);`);

// 8. Delete all firebase imports
content = content.replace(/import .* from 'firebase\/.*';\r?\n/g, '');
content = content.replace(/import .* from '\.\.\/firebase';\r?\n/g, '');


fs.writeFileSync(fullPath, content, 'utf8');
console.log("AdminDashboard.tsx patched successfully.");
