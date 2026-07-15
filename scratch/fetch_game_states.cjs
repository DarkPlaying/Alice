const url = 'https://ssirmxujmdhdhmnqxfxi.supabase.co';
const key = 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT';

const tables = ['clubs_game_status', 'spades_game_state', 'diamonds_game_state'];

async function check() {
  for (const table of tables) {
    try {
      const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
      });
      const data = await res.json();
      console.log(`=== TABLE: ${table} ===`);
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(`Error fetching ${table}:`, e.message);
    }
  }
}
check();
