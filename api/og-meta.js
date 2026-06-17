const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  const { gameId } = req.query;
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();

  if (!game) return res.redirect('https://chesswithclaw.vercel.app');

  const agentName = game.agent_name || 'OpenClaw';
  const moveCount = Array.isArray(game.move_history) ? game.move_history.length : 0;
  const resultText = game.winner === 'white'
    ? `Beat ${agentName} in ${moveCount} moves`
    : game.winner === 'black'
    ? `Lost to ${agentName} in ${moveCount} moves`
    : `Drew with ${agentName} in ${moveCount} moves`;

  const ogImageUrl = `https://chesswithclaw.vercel.app/api/og-image?gameId=${gameId}`;

  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="ChessWithClaw — ${resultText}" />
  <meta property="og:description" content="Challenge your own OpenClaw to a real-time chess match." />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:url" content="https://chesswithclaw.vercel.app/game/${gameId}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta http-equiv="refresh" content="0; url=https://chesswithclaw.vercel.app/game/${gameId}" />
</head>
<body>Redirecting...</body>
</html>`);
};
