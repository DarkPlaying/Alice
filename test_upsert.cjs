const url = 'https://ssirmxujmdhdhmnqxfxi.supabase.co';
const key = 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT';

fetch(`${url}/rest/v1/clubs_game_status?id=eq.clubs_king`, {
  method: 'PATCH',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    system_start: false,
    is_paused: false,
    current_round: 0,
    votes_submitted: 0,
    is_active: false,
    player_score: 0,
    master_score: 0,
    removed_cards_p: [],
    removed_cards_m: [], 
    scores: { current: {}, history: {}, high_player: { score: 0, uid: '-' }, high_master: { score: 0, uid: '-' } }, 
    round_data: { force_reset: Date.now() }, 
    gameState: 'idle',
    phase_expiry: null
  })
}).then(async r => {
  console.log(r.status, await r.text());
}).catch(console.error);
