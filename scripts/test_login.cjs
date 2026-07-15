const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ssirmxujmdhdhmnqxfxi.supabase.co';
const supabaseKey = 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogin() {
    console.log("--- SUPABASE SERVER DIAGNOSTIC ---");
    console.log("Sending login request to server...");
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'sanjay@borderland.com',
        password: 'Dark1123@#'
    });

    if (error) {
        console.error("\n❌ SERVER REJECTED LOGIN:");
        console.error("Error Message:", error.message);
        console.error("Error Status:", error.status);
    } else {
        console.log("\n✅ SERVER ACCEPTED LOGIN:");
        console.log("Logged in as:", data.user.email);
        console.log("User ID:", data.user.id);
        
        console.log("\nChecking 'profiles' table for user email:", data.user.email);
        const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('email', data.user.email).single();
        if (profileError) {
            console.error("❌ PROFILE NOT FOUND OR ERROR:", profileError.message);
        } else {
            console.log("✅ PROFILE FOUND:", profile);
        }
    }
    console.log("----------------------------------");
}

checkLogin();
