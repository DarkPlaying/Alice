const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ssirmxujmdhdhmnqxfxi.supabase.co', 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT');

async function testUpsert() {
    console.log("Calling upsert...");
    const res = await supabase.from('profiles').upsert({
        id: '8d6e3df9-899c-4f6d-a95b-1339412cb7cc',
        email: 'player2@borderland.app',
        username: 'player2',
        role: 'player',
        visa_points: 500
    });
    console.log("Upsert finished!", res);
}
testUpsert();
