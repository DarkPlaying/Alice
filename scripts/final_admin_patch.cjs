const fs = require('fs');
const path = require('path');

const fullPath = path.join(__dirname, '../src/components/AdminDashboard.tsx');
let content = fs.readFileSync(fullPath, 'utf8');

// 1. Remove Firebase imports
content = content.replace(/import \{.*?\} from 'firebase\/.*?';\r?\n/g, '');
content = content.replace(/import \{ db \} from '\.\.\/firebase';\r?\n/g, '');

// 2. Remove Firestore Backup Listener for Waitlist (Lines ~333-365)
content = content.replace(
    /\/\/ 2\. Firestore Handler \(Backup where waiting_for_game != null\)[\s\S]*?firestoreUsersRef\.current = fsUsers;\n\s*mergeAndSet\(\);\n\s*\}, \(err\) => \{\n\s*console\.error\("\[ADMIN\] Firestore Monitor Error:", err\);\n\s*\}\);/m,
    `// Firestore handler removed`
);

// 3. handleKickPlayer (Line ~375)
content = content.replace(
    /await updateDoc\(doc\(db, "users", userId\), \{\n\s*waiting_for_game: null\n\s*\}\);/m,
    `await supabase.from('profiles').update({ waiting_for_game: null }).eq('id', userId);`
);

// 4. clearAllWaitlist (Line ~405)
content = content.replace(
    /const q = query\(collection\(db, "users"\), where\("waiting_for_game", "!=", null\)\);[\s\S]*?await batch\.commit\(\);/m,
    `const { error } = await supabase.from('profiles').update({ waiting_for_game: null }).neq('waiting_for_game', null);
            if (error) throw error;`
);

// 5. handleBulkDelete (Line ~733)
content = content.replace(
    /const batch = writeBatch\(db\);[\s\S]*?await batch\.commit\(\);/m,
    `const { error } = await supabase.from('profiles').delete().in('id', safeIds);
            if (error) throw error;`
);

// 6. handleUndo (Line ~755)
content = content.replace(
    /const batch = writeBatch\(db\);[\s\S]*?await batch\.commit\(\);\n\s*\}/m,
    `if (lastActionType === 'delete') {
                const { error } = await supabase.from('profiles').insert(deletedBackup);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('profiles').delete().in('id', deletedBackup.map(u => u.id));
                if (error) throw error;
            }`
);

// 7. handleFileUpload (Line ~790)
content = content.replace(
    /\/\/ Initialize Secondary App once for the batch[\s\S]*?createdPlayersTmp\.push\(\{ id: userCredential\.user\.uid \}\);\n\s*successCount\+\+;/m,
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

// 8. handleCreatePlayer (Line ~870)
content = content.replace(
    /const handleCreatePlayer = async \(e: React\.FormEvent\) => \{[\s\S]*?setIsCreating\(false\);\n\s*\}\n\s*\};/m,
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
    };`
);

// 9. Realtime listener (Line ~1010)
content = content.replace(
    /\/\/ Real-time User Listener with Smart Caching\n\s*useEffect\(\(\) => \{[\s\S]*?return \(\) => unsubscribe\(\);\n\s*\}, \[\]\);/m,
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
    }, []);`
);

// 10. cleanup unsubFirestore
content = content.replace(/unsubFirestore\(\);/g, '');

fs.writeFileSync(fullPath, content, 'utf8');
console.log("AdminDashboard.tsx FULLY patched.");
