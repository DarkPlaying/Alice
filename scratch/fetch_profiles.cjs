const url = 'https://ssirmxujmdhdhmnqxfxi.supabase.co';
const key = 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT';

fetch(`${url}/rest/v1/profiles?select=*&limit=1`, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`
  }
}).then(r => r.json()).then(data => {
  console.log(JSON.stringify(data, null, 2));
}).catch(console.error);
