const fs = require('fs');
const path = require('path');

function fixTypes(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace user?.id with (user?.id as string) where it's used to define an ID variable
    content = content.replace(/const myUid = user\?\.id/g, 'const myUid = (user?.id as string)');
    content = content.replace(/const myId = user\?\.id/g, 'const myId = (user?.id as string)');
    
    // Replace in user_id assignments
    content = content.replace(/user_id: user\?\.id/g, 'user_id: user?.id as string');
    content = content.replace(/userId: user\?\.id/g, 'userId: user?.id as string');
    
    // Replace in template literals or targetId comparisons
    content = content.replace(/targetId === \(user\?\.id \|\|/g, 'targetId === ((user?.id as string) ||');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed types in', filePath);
}

fixTypes(path.join(__dirname, '..', 'src', 'components', 'games', 'ClubsGame.tsx'));
fixTypes(path.join(__dirname, '..', 'src', 'components', 'games', 'ClubsGameMaster.tsx'));
