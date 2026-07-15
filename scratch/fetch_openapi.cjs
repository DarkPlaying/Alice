const url = 'https://ssirmxujmdhdhmnqxfxi.supabase.co';
const key = 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT';

const tables = [
  'profiles',
  'clubs_game_status',
  'diamonds_game_state',
  'spades_game_state',
  'hearts_game_state',
  'messages',
  'clubs_game_sessions',
  'clubs_round_scores',
  'spades_bids',
  'diamonds_hands',
  'diamonds_slots',
  'diamonds_participants'
];

async function main() {
  for (const table of tables) {
    try {
      const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`Table: ${table}`);
        if (data.length > 0) {
          console.log(`  Columns: ${Object.keys(data[0]).join(', ')}`);
        } else {
          console.log(`  Table is empty, trying to post empty object or query schema metadata if possible`);
        }
      } else {
        console.log(`Table: ${table} - Error: ${data.message || JSON.stringify(data)}`);
      }
    } catch (e) {
      console.log(`Table: ${table} - Failed to fetch: ${e.message}`);
    }
  }
}

main();
