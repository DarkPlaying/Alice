const fs = require('fs');
const path = require('path');

const fullPath = path.join(__dirname, '../src/components/AdminDashboard.tsx');
let lines = fs.readFileSync(fullPath, 'utf8').split('\n');
let newLines = [];

let skip = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Clean up handleUndo remaining docRef
    if (line.includes("const docRef = doc(db, 'users', user.id);")) {
        continue;
    }
    if (line.includes("batch.delete(docRef);")) {
        continue;
    }

    // Clean up zombie logic in handleCreatePlayer
    if (line.includes("await setDoc(doc(db, \"users\", existingUid), {")) {
        skip = true;
        newLines.push(`                            await supabase.from('profiles').update({`);
        newLines.push(`                                username: newUsername.split('@')[0],`);
        newLines.push(`                                email: email,`);
        newLines.push(`                                role: activeView === 'masters' ? 'master' : 'player',`);
        newLines.push(`                                status: 'alive',`);
        newLines.push(`                                visa_points: 500,`);
        newLines.push(`                            }).eq('id', existingUid);`);
        continue;
    }
    if (skip && line.includes("visaDays: 500,")) {
        i++; // skip `                            });`
        skip = false;
        continue;
    }
    
    if (line.includes("await setDoc(doc(db, \"users\", recoveredUser.uid), {")) {
        skip = true;
        newLines.push(`                            await supabase.from('profiles').update({`);
        newLines.push(`                                username: newUsername.split('@')[0],`);
        newLines.push(`                                email: email,`);
        newLines.push(`                                role: activeView === 'masters' ? 'master' : 'player',`);
        newLines.push(`                                status: 'alive',`);
        newLines.push(`                                visa_points: 500,`);
        newLines.push(`                            }).eq('id', recoveredUser.uid);`);
        continue;
    }
    if (skip && line.includes("visaDays: 500,")) { // wait, I already used `visaDays: 500,` but it's safe.
        i++; // skip `                            });`
        skip = false;
        continue;
    }

    // Clean up updateSuitMasterState
    if (line.includes("await setDoc(doc(db, 'active_games', suitKey), {")) {
        skip = true;
        newLines.push(`                                                    await supabase.from(suit === 'spades' ? 'spades_game_status' : 'clubs_game_status').update({ allowed_players: allowedIds }).eq('id', suitKey);`);
        continue;
    }
    if (skip && line.includes("updatedAt: serverTimestamp()")) {
        i++; // skip `                                                    }, { merge: true });`
        skip = false;
        continue;
    }

    if (!skip) {
        newLines.push(line);
    }
}

fs.writeFileSync(fullPath, newLines.join('\n'), 'utf8');
console.log("AdminDashboard.tsx final state machine cleanup patched.");
