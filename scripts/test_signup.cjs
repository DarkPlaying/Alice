const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ssirmxujmdhdhmnqxfxi.supabase.co';
const supabaseKey = 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT';

const adminAuthClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
    }
});

async function testSignup() {
    const { data, error } = await adminAuthClient.auth.signUp({
        email: 'player1@borderland.app',
        password: 'password123'
    });
    console.log("Signup error:", error ? error.message : "SUCCESS");
}
testSignup();
