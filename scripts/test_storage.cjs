const { createClient } = require('@supabase/supabase-js');

const mockStorage = {};
const supabase = createClient('https://ssirmxujmdhdhmnqxfxi.supabase.co', 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT', {
    auth: {
        storage: {
            getItem: (key) => mockStorage[key] || null,
            setItem: (key, val) => { mockStorage[key] = val; },
            removeItem: (key) => { delete mockStorage[key]; }
        },
        storageKey: 'test-key'
    }
});

async function test() {
    const response = await fetch('https://ssirmxujmdhdhmnqxfxi.supabase.co/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT',
        },
        body: JSON.stringify({ email: 'sanjay@borderland.com', password: 'Dark1123@#' })
    });
    const resultData = await response.json();
    resultData.expires_at = Math.floor(Date.now() / 1000) + (resultData.expires_in || 3600);
    
    mockStorage['test-key'] = JSON.stringify(resultData);
    
    // Now ask gotrue-js to initialize and see if it accepts our manually crafted storage!
    const { data: { session } } = await supabase.auth.getSession();
    console.log("DID GOTRUE-JS ACCEPT IT?", session !== null);
    if (!session) {
        console.log("Gotrue-js REJECTED our crafted storage! Reason unknown.");
    } else {
        console.log("Gotrue-js ACCEPTED it!");
    }
}

test();
