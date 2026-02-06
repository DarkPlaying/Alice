
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dweeanxonatdmlqfnsai.supabase.co';
const supabaseKey = 'sb_publishable_dIOrmzsUuKBS59t8uZwPEg_NTj17PaZ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
    console.log("Checking Diamonds State...");
    const { data, error } = await supabase.from('clubs_game_status').select('*').eq('id', 'diamonds_king').maybeSingle();

    if (data) {
        console.log("Current State:", data);
        console.log("Forcing reset of system_start to FALSE...");
        const { error: updateError } = await supabase.from('clubs_game_status').update({
            system_start: false,
            is_active: false,
            is_paused: false,
            phase: 'idle',
            allowed_players: [],
            participants: []
        }).eq('id', 'diamonds_king');

        if (updateError) console.error("Update failed:", updateError);
        else console.log("SUCCESS: State reset to false.");
    } else {
        console.error("Row not found or error:", error);
    }
}

fix();
