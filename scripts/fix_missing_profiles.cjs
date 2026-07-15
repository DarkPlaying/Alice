const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ssirmxujmdhdhmnqxfxi.supabase.co', 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT');

async function fixMissingProfiles() {
    console.log("Fixing missing profiles...");
    
    const missingProfiles = [
        {
            id: '47ac0652-18c9-4159-bb84-d8cad0c2d830',
            email: 'player1@borderland.app',
            username: 'player1',
            role: 'player',
            visa_points: 500
        },
        {
            id: '6317cd20-8eef-46a4-9191-b16892b939bb',
            email: 'player2@borderland.app',
            username: 'player2',
            role: 'player',
            visa_points: 500
        },
        {
            id: '187810f4-4227-46be-996d-6a006a85646d',
            email: 'player3@borderland.app',
            username: 'player3',
            role: 'player',
            visa_points: 500
        }
    ];

    for (const profile of missingProfiles) {
        const { error } = await supabase.from('profiles').upsert(profile);
        if (error) {
            console.error(`Failed to insert ${profile.username}:`, error);
        } else {
            console.log(`Successfully restored ${profile.username}!`);
        }
    }
}
fixMissingProfiles();
