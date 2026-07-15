const fs = require('fs');
const path = require('path');

function migrateFirebaseToSupabase(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove imports
    content = content.replace(/import \{ collection, getDocs \} from 'firebase\/firestore';\r?\n/, '');
    content = content.replace(/import \{ db, auth \} from '\.\.\/\.\.\/firebase';\r?\n/, '');
    content = content.replace(/import \{ auth, db \} from '\.\.\/\.\.\/firebase';\r?\n/, '');
    content = content.replace(/import \{ db \} from '\.\.\/\.\.\/firebase';\r?\n/, '');

    // Replace auth.currentUser
    content = content.replace(/auth\.currentUser\?\.uid/g, 'user?.id');
    content = content.replace(/auth\.currentUser\?\.email/g, 'user?.email');
    content = content.replace(/auth\.currentUser/g, 'user');
    
    // Replace fetchPlayerIds firestore logic
    const firestoreLogic = `const querySnapshot = await getDocs(collection(db, 'users'));
                const users: any[] = [];
                querySnapshot.forEach((doc) => {
                    users.push({ id: doc.id, ...doc.data() });
                });`;
    
    const supabaseLogic = `const { data: users, error } = await supabase.from('users').select('*');
                if (error) throw error;`;
                
    content = content.replace(firestoreLogic, supabaseLogic);
    
    // Also try without exact whitespace match just in case
    const firestoreRegex = /const querySnapshot = await getDocs\(collection\(db, 'users'\)\);[\s\S]*?querySnapshot\.forEach\(\(doc\) => \{[\s\S]*?users\.push\(\{ id: doc\.id, \.\.\.doc\.data\(\) \}\);[\s\S]*?\}\);/;
    content = content.replace(firestoreRegex, supabaseLogic);
    
    // Fix error message
    content = content.replace(/Error fetching player IDs \(Firebase\):/g, 'Error fetching player IDs:');
    
    // Simplify some ugly redundant ternary expressions caused by the replacement
    content = content.replace(/user\?\.id \|\| \(user as any\)\?\.id/g, 'user?.id');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Migrated', filePath);
}

migrateFirebaseToSupabase(path.join(__dirname, '..', 'src', 'components', 'games', 'ClubsGame.tsx'));
migrateFirebaseToSupabase(path.join(__dirname, '..', 'src', 'components', 'games', 'ClubsGameMaster.tsx'));
