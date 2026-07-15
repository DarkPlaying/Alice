const res = await fetch(
  'https://ssirmxujmdhdhmnqxfxi.supabase.co/rest/v1/profiles?role=eq.player',
  {
    method: 'PATCH',
    headers: {
      'apikey': 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT',
      'Authorization': 'Bearer sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT',
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ visa_points: 2000 })
  }
);
const result = await res.json();
console.log('Updated players:', result.length, result);
