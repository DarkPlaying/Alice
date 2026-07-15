const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://ssirmxujmdhdhmnqxfxi.supabase.co', 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT');

async function testAnonQuery() {
    const { data, error } = await supabase.from('profiles').select('email').eq('username', 'sanjay').single();
    console.log("Anon Query Result:", data);
    console.log("Anon Query Error:", error ? error.message : "NONE");
}
testAnonQuery();
