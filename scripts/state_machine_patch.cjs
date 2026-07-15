const fs = require('fs');
const path = require('path');

const fullPath = path.join(__dirname, '../src/components/AdminDashboard.tsx');
let lines = fs.readFileSync(fullPath, 'utf8').split('\n');
let newLines = [];

let skip = false;

// We will use a state machine to skip over blocks and inject new code.
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Remove firebase imports
    if (line.includes("from 'firebase/") || line.includes("from '../firebase'")) {
        continue;
    }

    // 2. Remove Waitlist Listener
    if (line.includes("// 2. Firestore Handler (Backup where waiting_for_game != null)")) {
        skip = true;
        continue;
    }
    if (skip && line.includes("firestoreUsersRef.current = fsUsers;")) {
        // We skip until the end of this block
    }
    if (skip && line.includes("console.error(\"[ADMIN] Firestore Monitor Error:\", err);")) {
        // Next line is `        });`, so we skip next line too
        i++; // skip `});`
        skip = false;
        continue;
    }

    // Remove `unsubFirestore();`
    if (!skip && line.includes("unsubFirestore();")) {
        continue;
    }

    // 3. handleKickPlayer
    if (line.includes("// 1. Clear Firestore status (Persistence)")) {
        skip = true;
        newLines.push(`            if (userId) {`);
        newLines.push(`                await supabase.from('profiles').update({ waiting_for_game: null }).eq('id', userId);`);
        newLines.push(`            }`);
        continue;
    }
    if (skip && line.includes("// 2. Broadcast Transient Kick (Realtime)")) {
        skip = false;
        newLines.push(line);
        continue;
    }

    // 4. handleGlobalPurgeQueue
    if (line.includes(`const q = query(collection(db, "users"), where("waiting_for_game", "!=", null));`)) {
        skip = true;
        newLines.push(`            const { error } = await supabase.from('profiles').update({ waiting_for_game: null }).neq('waiting_for_game', null);`);
        newLines.push(`            if (error) throw error;`);
        continue;
    }
    if (skip && line.includes(`await batch.commit();`)) {
        skip = false;
        continue;
    }

    // 5. handleBulkDelete
    if (line.includes(`const batch = writeBatch(db);`) && lines[i+1].includes(`safeIds.forEach(id => {`)) {
        skip = true;
        newLines.push(`            const { error } = await supabase.from('profiles').delete().in('id', safeIds);`);
        newLines.push(`            if (error) throw error;`);
        continue;
    }
    if (skip && line.includes(`await batch.commit();`) && lines[i+2].includes(`setLastActionType('delete');`)) {
        skip = false;
        continue;
    }

    // 6. handleUndo
    if (line.includes(`const batch = writeBatch(db);`) && lines[i+1].includes(`if (lastActionType === 'delete') {`)) {
        skip = true;
        newLines.push(`            if (lastActionType === 'delete') {`);
        newLines.push(`                const { error } = await supabase.from('profiles').insert(deletedBackup);`);
        newLines.push(`                if (error) throw error;`);
        newLines.push(`            } else {`);
        newLines.push(`                const { error } = await supabase.from('profiles').delete().in('id', deletedBackup.map(u => u.id));`);
        newLines.push(`                if (error) throw error;`);
        newLines.push(`                alert("BATCH UPLOAD REVERTED. IDENTITIES PURGED.");`);
        newLines.push(`            }`);
        continue;
    }
    if (skip && line.includes(`alert("BATCH UPLOAD REVERTED. IDENTITIES PURGED.");`)) {
        // Next line is `            }`, then `setShowUndo(false);`
        i++; // skip `}`
        skip = false;
        continue;
    }

    // 7. handleFileUpload
    if (line.includes(`// Initialize Secondary App once for the batch`)) {
        skip = true;
        newLines.push(`                const createdPlayersTmp: any[] = [];`);
        newLines.push(`                let successCount = 0;`);
        newLines.push(`                let failCount = 0;`);
        newLines.push(`                for (let i = 0; i < users.length; i++) {`);
        newLines.push(`                    const user = users[i];`);
        newLines.push(`                    try {`);
        newLines.push(`                        if (!user.username || !user.password) continue;`);
        newLines.push(`                        const email = user.username.includes('@') ? user.username : \\\`\\\${user.username}@borderland.com\\\`;`);
        newLines.push(`                        const { data, error } = await supabase.auth.signUp({ email, password: user.password });`);
        newLines.push(`                        if (error) throw error;`);
        newLines.push(`                        await supabase.from('profiles').update({ username: user.username.split('@')[0], role: activeView === 'masters' ? 'master' : 'player', status: 'alive', visa_points: 500 }).eq('id', data.user?.id);`);
        newLines.push(`                        createdPlayersTmp.push({ id: data.user?.id });`);
        newLines.push(`                        successCount++;`);
        newLines.push(`                    } catch (err) {`);
        newLines.push(`                        console.error("Batch create err:", err);`);
        newLines.push(`                        failCount++;`);
        newLines.push(`                    }`);
        newLines.push(`                    setUploadProgress(prev => ({ ...prev, current: i + 1 }));`);
        newLines.push(`                }`);
        continue;
    }
    if (skip && line.includes(`await deleteApp(secondaryApp);`)) {
        skip = false;
        continue;
    }

    // 8. handleCreatePlayer
    if (line.includes(`const handleCreatePlayer = async (e: React.FormEvent) => {`)) {
        skip = true;
        newLines.push(`    const handleCreatePlayer = async (e: React.FormEvent) => {`);
        newLines.push(`        e.preventDefault();`);
        newLines.push(`        setCreateError(null);`);
        newLines.push(`        setIsCreating(true);`);
        newLines.push(`        try {`);
        newLines.push(`            if (newPassword.length < 6) throw new Error("PASSWORD MUST BE AT LEAST 6 CHARACTERS.");`);
        newLines.push(`            const email = newUsername.includes('@') ? newUsername : \\\`\\\${newUsername}@borderland.com\\\`;`);
        newLines.push(`            const { data, error } = await supabase.auth.signUp({ email, password: newPassword });`);
        newLines.push(`            if (error) throw error;`);
        newLines.push(`            await supabase.from('profiles').update({ username: newUsername.split('@')[0], role: activeView === 'masters' ? 'master' : 'player', status: 'alive', visa_points: 500 }).eq('id', data.user?.id);`);
        newLines.push(`            setNewUsername('');`);
        newLines.push(`            setNewPassword('');`);
        newLines.push(`            setShowCreateForm(false);`);
        newLines.push(`            setDeletedBackup([{ id: data.user?.id }]);`);
        newLines.push(`            setLastActionType('create');`);
        newLines.push(`            setShowUndo(true);`);
        newLines.push(`            setTimeout(() => setShowUndo(false), 10000);`);
        newLines.push(`        } catch (err: any) {`);
        newLines.push(`            console.error("Creation Error:", err);`);
        newLines.push(`            setCreateError(err.message || "SYSTEM ERROR");`);
        newLines.push(`        } finally {`);
        newLines.push(`            setIsCreating(false);`);
        newLines.push(`        }`);
        newLines.push(`    };`);
        continue;
    }
    if (skip && line.includes(`const downloadSampleCsv = () => {`)) {
        skip = false;
        newLines.push(line);
        continue;
    }

    // 9. Real-time User Listener (fetchProfiles)
    if (line.includes(`// Real-time User Listener with Smart Caching`)) {
        skip = true;
        newLines.push(`    // Real-time User Listener with Smart Caching`);
        newLines.push(`    useEffect(() => {`);
        newLines.push(`        const cached = PlayerCache.get();`);
        newLines.push(`        if (cached) {`);
        newLines.push(`            setPlayers(cached);`);
        newLines.push(`            setStats(prev => prev.map(stat => stat.label === 'Active Players' ? { ...stat, value: cached.length.toString() } : stat));`);
        newLines.push(`        }`);
        newLines.push(`        const fetchProfiles = async () => {`);
        newLines.push(`            const { data, error } = await supabase.from('profiles').select('*');`);
        newLines.push(`            if (!error && data) {`);
        newLines.push(`                setStats(prev => prev.map(stat => stat.label === 'Active Players' ? { ...stat, value: data.length.toString() } : stat));`);
        newLines.push(`                const playersData = data.sort((a: any, b: any) => {`);
        newLines.push(`                    const isMasterA = a.role === 'master' || a.role === 'admin' || a.username === 'admin';`);
        newLines.push(`                    const isMasterB = b.role === 'master' || b.role === 'admin' || b.username === 'admin';`);
        newLines.push(`                    if (isMasterA && !isMasterB) return -1;`);
        newLines.push(`                    if (!isMasterA && isMasterB) return 1;`);
        newLines.push(`                    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();`);
        newLines.push(`                });`);
        newLines.push(`                setPlayers(playersData);`);
        newLines.push(`                PlayerCache.set(playersData);`);
        newLines.push(`            }`);
        newLines.push(`        };`);
        newLines.push(`        fetchProfiles();`);
        newLines.push(`        const channel = supabase.channel('public:profiles_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchProfiles).subscribe();`);
        newLines.push(`        return () => { supabase.removeChannel(channel); };`);
        newLines.push(`    }, []);`);
        continue;
    }
    if (skip && line.includes(`// Clear selection when view changes`)) {
        skip = false;
        newLines.push(line);
        continue;
    }

    // 10. handleStartHearts
    if (line.includes(`const gameRef = doc(db, 'games', 'hearts_main');`)) {
        skip = true;
        continue;
    }
    if (skip && line.includes(`console.warn("Firestore sync failed (Permissions)");`)) {
        i++; // skip `}`
        skip = false;
        continue;
    }

    if (!skip) {
        newLines.push(line);
    }
}

fs.writeFileSync(fullPath, newLines.join('\n'), 'utf8');
console.log("AdminDashboard.tsx STATEMACHINE patched.");
