const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ssirmxujmdhdhmnqxfxi.supabase.co', 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT');

async function cleanOrphans() {
    console.log("Cleaning up orphaned profiles...");
    
    // The usernames we know were deleted from Auth
    const usernamesToDelete = ['player1', 'player2', 'player3'];
    
    for (const username of usernamesToDelete) {
        const { error } = await supabase.from('profiles').delete().eq('username', username);
        if (error) {
            console.error(`Failed to delete ${username}:`, error);
        } else {
            console.log(`Successfully removed orphaned profile: ${username}`);
        }
    }
}

cleanOrphans();
