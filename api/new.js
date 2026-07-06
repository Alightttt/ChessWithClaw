const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

module.exports = async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your_supabase') || !supabaseUrl.startsWith('http')) {
    console.error('Missing or invalid: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    res.setHeader('Location', '/?error=1');
    res.status(302).end();
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const gameId = randomUUID();
    const agentToken = randomUUID();
    const secretToken = randomUUID();
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 24*60*60*1000).toISOString();

    const { data: game, error } = await supabase
      .from('games')
      .insert({
        id: gameId,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        turn: 'w',
        status: 'waiting',
        move_number: 0,
        in_check: false,
        agent_connected: false,
        agent_token: agentToken,
        secret_token: secretToken,
        created_at: now,
        updated_at: now,
        expires_at: expires
      })
      .select()
      .single();

    if (error || !game) {
      console.error('Game creation failed on direct new endpoint:', error);
      res.setHeader('Location', '/?error=1');
      res.status(302).end();
      return;
    }

    // Set cookie with max-age (1 day) & Lax same-site to transfer ownership token securely.
    res.setHeader('Set-Cookie', `game_owner_${game.id}=${secretToken}; Path=/; Max-Age=86400; SameSite=Lax`);
    res.setHeader('Location', '/created/' + game.id);
    res.status(302).end();
  } catch (error) {
    console.error('Create game error on direct new endpoint:', error);
    res.setHeader('Location', '/?error=1');
    res.status(302).end();
  }
};
