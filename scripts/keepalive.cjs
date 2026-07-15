const https = require('https');

// Provided Supabase credentials
const SUPABASE_URL = 'https://ssirmxujmdhdhmnqxfxi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT';

function pingSupabase() {
    console.log(`[${new Date().toISOString()}] Sending keepalive request to Supabase...`);
    
    // We ping the REST API root to keep the project active
    const options = {
        hostname: new URL(SUPABASE_URL).hostname,
        path: '/rest/v1/',
        method: 'GET',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    };

    const req = https.request(options, (res) => {
        console.log(`Response Status: ${res.statusCode}`);
        // Read data to free up memory
        res.on('data', () => {});
        res.on('end', () => {
            console.log('Keepalive request completed.');
        });
    });

    req.on('error', (error) => {
        console.error('Error sending keepalive request:', error.message);
    });

    req.end();
}

// Execute once and exit (GitHub Actions will handle the hourly scheduling)
pingSupabase();
