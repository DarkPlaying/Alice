const fs = require('fs');
const path = require('path');

const fullPath = path.join(__dirname, '../src/components/AdminDashboard.tsx');
let content = fs.readFileSync(fullPath, 'utf8');

// Normalize line endings to \n to make indexOf work reliably
content = content.replace(/\r\n/g, '\n');

function replaceBetween(startStr, endStr, replacement) {
    const startIdx = content.indexOf(startStr);
    if (startIdx === -1) {
        console.log("Could not find start: " + startStr.substring(0, 30));
        return;
    }
    const endIdx = content.indexOf(endStr, startIdx);
    if (endIdx === -1) {
        console.log("Could not find end: " + endStr.substring(0, 30));
        return;
    }
    content = content.substring(0, startIdx) + replacement + content.substring(endIdx + endStr.length);
    console.log("Successfully replaced block starting with: " + startStr.substring(0, 30));
}

// 1. Remove Waitlist Listener
replaceBetween(
    "// 2. Firestore Handler (Backup where waiting_for_game != null)",
    "        });", // This is the end of unsubFirestore
    "// Firestore handler removed\n"
);
content = content.replace(/unsubFirestore\(\);/g, '');

// 2. handleKickPlayer
replaceBetween(
    "// 1. Clear Firestore status (Persistence)",
    "// 2. Broadcast Transient Kick (Realtime)",
    `if (userId) {
                await supabase.from('profiles').update({ waiting_for_game: null }).eq('id', userId);
            }

            `
);

// 3. handleUndo
replaceBetween(
    "const handleUndo = async () => {",
    "setShowUndo(false);",
    `const handleUndo = async () => {
        if (!deletedBackup.length) return;

        try {
            if (lastActionType === 'delete') {
                const { error } = await supabase.from('profiles').insert(deletedBackup);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('profiles').delete().in('id', deletedBackup.map(u => u.id));
                if (error) throw error;
                alert("BATCH UPLOAD REVERTED. IDENTITIES PURGED.");
            }
            `
);

// 4. handleFileUpload
replaceBetween(
    "// Initialize Secondary App once for the batch",
    "// Cleanup",
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
                        successCount++;
                    } catch (err) {
                        console.error("Batch create err:", err);
                        failCount++;
                    }
                    setUploadProgress({ current: i + 1, total: users.length });
                }
                `
);
content = content.replace(/\/\/ Cleanup\n\s*await deleteApp\(secondaryApp\);/g, '');

// 5. handleCreatePlayer
replaceBetween(
    "const handleCreatePlayer = async (e: React.FormEvent) => {",
    "const downloadSampleCsv = () => {",
    `const handleCreatePlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError(null);
        setIsCreating(true);
        try {
            if (newPassword.length < 6) throw new Error("PASSWORD MUST BE AT LEAST 6 CHARACTERS.");
            const email = newUsername.includes('@') ? newUsername : \`\${newUsername}@borderland.com\`;
            
            const { data, error } = await supabase.auth.signUp({ email, password: newPassword });
            if (error) throw error;
            
            await supabase.from('profiles').update({
                username: newUsername.split('@')[0],
                role: activeView === 'masters' ? 'master' : 'player',
                status: 'alive',
                visa_points: 500
            }).eq('id', data.user?.id);
            
            setNewUsername('');
            setNewPassword('');
            setShowCreateForm(false);
            
            setDeletedBackup([{ id: data.user?.id }]);
            setLastActionType('create');
            setShowUndo(true);
            setTimeout(() => setShowUndo(false), 10000);
        } catch (err: any) {
            console.error("Creation Error:", err);
            setCreateError(err.message || "SYSTEM ERROR");
        } finally {
            setIsCreating(false);
        }
    };

    `
);

// 6. Realtime User Listener (fetchProfiles)
replaceBetween(
    "// Real-time User Listener with Smart Caching",
    "// Clear selection when view changes",
    `// Real-time User Listener with Smart Caching
    useEffect(() => {
        const cached = PlayerCache.get();
        if (cached) {
            setPlayers(cached);
            setStats(prev => prev.map(stat => stat.label === 'Active Players' ? { ...stat, value: cached.length.toString() } : stat));
        }

        const fetchProfiles = async () => {
            const { data, error } = await supabase.from('profiles').select('*');
            if (!error && data) {
                setStats(prev => prev.map(stat => stat.label === 'Active Players' ? { ...stat, value: data.length.toString() } : stat));
                const playersData = data.sort((a: any, b: any) => {
                    const isMasterA = a.role === 'master' || a.role === 'admin' || a.username === 'admin';
                    const isMasterB = b.role === 'master' || b.role === 'admin' || b.username === 'admin';
                    if (isMasterA && !isMasterB) return -1;
                    if (!isMasterA && isMasterB) return 1;
                    const timeA = new Date(a.created_at || 0).getTime();
                    const timeB = new Date(b.created_at || 0).getTime();
                    return timeA - timeB;
                });
                setPlayers(playersData);
                PlayerCache.set(playersData);
            }
        };

        fetchProfiles();
        const channel = supabase.channel('public:profiles_admin')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchProfiles)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    `
);

// 7. handleStartHearts
replaceBetween(
    "const gameRef = doc(db, 'games', 'hearts_main');",
    "} catch (e) {",
    "// Sync handled by Supabase\n"
);
content = content.replace(/console\.warn\("Firestore sync failed \(Permissions\)"\);/g, '');

// 8. Remove firebase imports
content = content.replace(/import \{.*?\} from 'firebase\/.*?';\n/g, '');
content = content.replace(/import \{ db \} from '\.\.\/firebase';\n/g, '');

fs.writeFileSync(fullPath, content, 'utf8');
console.log("AdminDashboard.tsx FOOLPROOF patched.");
