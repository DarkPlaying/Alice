const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ssirmxujmdhdhmnqxfxi.supabase.co', 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT');

async function testUpsert() {
    console.log("Calling upsert...");
    const res = await supabase.from('profiles').upsert({
        id: '187810f4-4227-46be-996d-6a006a85646d',
        email: 'player3@borderland.app',
        username: 'player3',
        role: 'player',
        status: 'alive',
        visa_points: 500
    });
    console.log("Upsert finished!", res);
}
testUpsert();
