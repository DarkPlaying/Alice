import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ssirmxujmdhdhmnqxfxi.supabase.co';
const supabaseAnonKey = 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function pingDatabase() {
    try {
        console.log(`[${new Date().toISOString()}] Pinging database to keep it awake...`);
        // Fetch 1 row from profiles to keep the database active
        const { data, error } = await supabase.from('profiles').select('id').limit(1);
        
        if (error) {
            console.error(`[${new Date().toISOString()}] Ping Failed:`, error.message);
        } else {
            console.log(`[${new Date().toISOString()}] Ping Successful. DB is active.`);
        }
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Ping Error:`, err);
    }
}

// Initial ping
pingDatabase();

// Ping every 1 minute (60000 milliseconds) unlimitedly
setInterval(pingDatabase, 60000);
