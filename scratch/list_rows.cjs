const url = 'https://ssirmxujmdhdhmnqxfxi.supabase.co';
const key = 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT';

fetch(`${url}/rest/v1/clubs_game_status?select=id`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` }
}).then(r => r.json()).then(data => {
  console.log(data);
}).catch(console.error);
