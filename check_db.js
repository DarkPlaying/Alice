
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkColumns() {
    const { data, error } = await supabase.from('clubs_game_status').select('*').limit(1);
    if (error) {
        console.error(error);
    } else if (data && data.length > 0) {
        console.log(Object.keys(data[0]));
    } else {
        console.log("No data found");
    }
}

checkColumns();
