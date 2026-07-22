import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup env variables from .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
    process.exit(1);
}

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
