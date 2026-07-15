const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ssirmxujmdhdhmnqxfxi.supabase.co', 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT');

async function testFetch() {
    console.log("Fetching profiles...");
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Found ${data.length} profiles!`);
        console.log(data);
    }
}
testFetch();
