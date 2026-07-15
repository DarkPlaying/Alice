import { supabase } from './src/supabaseClient'; 
async function get() { 
  const { data } = await supabase.from('clubs_game_status').select('*').eq('id', 'clubs_king').single(); 
  console.log(JSON.stringify(data, null, 2)); 
  process.exit(0); 
} 
get();
