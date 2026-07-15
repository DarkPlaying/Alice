// RECOVERY SCRIPT: Restore all players with visa_points = -1 back to 1000
// Run with: node scratch/restore_points.cjs

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ssirmxujmdhdhmnqxfxi.supabase.co';
const supabaseKey = 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT';

const supabase = createClient(supabaseUrl, supabaseKey);

async function restorePoints() {
    console.log('🔍 Fetching all players with visa_points = -1...');
    
    const { data, error } = await supabase
        .from('profiles')
        .select('id, username, visa_points')
        .eq('visa_points', -1)
        .eq('role', 'player');

    if (error) {
        console.error('❌ Fetch error:', error.message);
        return;
    }

    console.log(`Found ${data.length} players with -1 points:`);
    data.forEach(p => console.log(`  - ${p.username} (${p.id})`));

    if (data.length === 0) {
        console.log('✅ No players to restore.');
        return;
    }

    const { error: updateError } = await supabase
        .from('profiles')
        .update({ visa_points: 1000 })
        .eq('visa_points', -1)
        .eq('role', 'player');

    if (updateError) {
        console.error('❌ Update error:', updateError.message);
    } else {
        console.log(`✅ Successfully restored ${data.length} players to 1000 points.`);
    }
}

restorePoints();
