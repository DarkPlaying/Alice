const fs = require('fs');
const path = require('path');

function replaceAll(filePath) {
    const fullPath = path.join(__dirname, '../src/components/games', filePath);
    if (!fs.existsSync(fullPath)) return;
    
    let content = fs.readFileSync(fullPath, 'utf8');

    // 1. Remove firebase imports (robust to line endings)
    content = content.replace(/import \{ collection, getDocs \} from 'firebase\/firestore';\r?\n/g, '');
    content = content.replace(/import \{ auth, db \} from '\.\.\/\.\.\/firebase';\r?\n/g, '');
    content = content.replace(/import \{ db, auth \} from '\.\.\/\.\.\/firebase';\r?\n/g, '');

    // 2. Replace all auth.currentUser references
    content = content.replace(/auth\.currentUser\?\.uid/g, 'user?.id');
    content = content.replace(/auth\.currentUser\?\.email/g, 'user?.email');
    content = content.replace(/auth\.currentUser/g, 'user');

    // 3. Replace Firestore fetch with Supabase fetch
    const firestoreFetchRegex = /const querySnapshot = await getDocs\(collection\(db, 'users'\)\);[\s\S]*?\}\);/m;
    const supabaseFetch = `const { data: profiles } = await supabase.from('profiles').select('*');
                const users = (profiles || []).map((doc: any) => ({
                    id: doc.id,
                    ...doc
                }));

                // Sort users to match Admin Dashboard logic
                users.sort((a: any, b: any) => {
                    const isMasterA = a.role === 'master' || a.role === 'admin' || a.username === 'admin';
                    const isMasterB = b.role === 'master' || b.role === 'admin' || b.username === 'admin';
                    if (isMasterA && !isMasterB) return -1;
                    if (!isMasterA && isMasterB) return 1;
                    const timeA = new Date(a.created_at || 0).getTime();
                    const timeB = new Date(b.created_at || 0).getTime();
                    return timeA - timeB;
                });`;

    content = content.replace(firestoreFetchRegex, supabaseFetch);

    // Write back
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Updated ${filePath}`);
}

replaceAll('ClubsGame.tsx');
replaceAll('ClubsGameMaster.tsx');
