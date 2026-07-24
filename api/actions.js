const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');
const { applySecurityHeaders, applyCacheControl, applyCorsHeaders } = require('../server-lib/middleware/headers.js');
const { validateUUID } = require('../server-lib/utils/sanitize.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token, x-game-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Database configuration missing.' });
  }

  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  let { gameId, action, message, setting, value } = req.body || {};

  const agentToken = req.headers['x-agent-token'];
  const gameToken = req.headers['x-game-token'];

  const validActions = [
    'offer_draw', 'resign', 'accept_draw', 'decline_draw', 'set_thought_language', 'set_board_theme', 'set_piece_style', 'heartbeat', 'save_push_subscription', 'send_reengagement_push', 'get_vapid_key'
  ];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Invalid action', allowed: validActions });
  }

  const DISPLAY_ACTIONS = ['set_board_theme', 'set_piece_style', 'set_thought_language', 'save_push_subscription', 'send_reengagement_push', 'get_vapid_key'];

  if (!DISPLAY_ACTIONS.includes(action) && !agentToken && !gameToken) {
    return res.status(401).json({ error: 'Unauthorized: Missing token header.', code: 'INVALID_TOKEN' });
  }

  if (action !== 'send_reengagement_push' && action !== 'get_vapid_key' && (!gameId || !action)) {
    return res.status(400).json({ error: 'Missing gameId or action' });
  }
  if (!validateUUID(gameId)) {
    return res.status(400).json({ error: 'Invalid gameId format' });
  }

  try {
    const supabase = createClient(
      (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let game = null; let error = null;
    if (gameId) { const res = await supabase.from('games').select('*').eq('id', gameId).single(); game = res.data; error = res.error; }

    if (action !== 'send_reengagement_push' && action !== 'get_vapid_key' && (error || !game)) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game && (game.status === 'finished' || game.status === 'abandoned')) {
      if (action === 'heartbeat') {
        return res.status(200).json({ alive: false, status: game.status });
      }
      return res.status(400).json({ error: 'Game is already over', code: 'GAME_FINISHED' });
    }

    // Determine role and authorize
    let role = '';
    
    if (DISPLAY_ACTIONS.includes(action)) {
      // Allow without specific role checking, relying on just knowing the gameId
    } else if (agentToken) {
      if (agentToken !== game.agent_token) {
        return res.status(401).json({ "error": "Unauthorized", "code": "INVALID_TOKEN" });
      }
      role = 'agent';
    } else {
      if (gameToken !== game.secret_token) {
        return res.status(401).json({ "error": "Unauthorized", "code": "INVALID_TOKEN" });
      }
      role = 'human';
    }

    const agentName = game.agent_name || 'OpenClaw';
    const now = new Date().toISOString();
    let updates = {};
    let chatText = '';
    let result = undefined;
    let result_reason = '';

    if (action === 'get_vapid_key') {
      return res.status(200).json({ success: true, key: process.env.VAPID_PUBLIC_KEY || '' });
    } else if (action === 'save_push_subscription') {
      const { subscription } = req.body;
      if (!subscription) return res.status(400).json({ error: 'Missing subscription' });
      // Generate a unique ID based on the endpoint or gameId to avoid duplicates
      const subId = Buffer.from(subscription.endpoint).toString('base64').substring(0, 50);
      
      const { error: insertError } = await supabase.from('push_subscriptions').upsert({
        id: subId,
        subscription: subscription
      }, { onConflict: 'id' });
      if (insertError) {
        console.error('Insert error', insertError);
        return res.status(500).json({ error: 'Failed to save subscription' });
      }
      return res.status(200).json({ success: true });
    } else if (action === 'send_reengagement_push') {
      if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        webpush.setVapidDetails(
          'mailto:hello@example.com',
          process.env.VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY
        );
      } else {
        return res.status(500).json({ error: 'VAPID keys not configured' });
      }

      // We want to fetch subscriptions where last_notified_at is null or more than 20 hours old
      const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
      const { data: subs, error: subsError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .or(`last_notified_at.is.null,last_notified_at.lt.${twentyHoursAgo}`);
      
      if (subsError) return res.status(500).json({ error: 'Database error' });
      
      let sentCount = 0;
      for (const sub of (subs || [])) {
        try {
          // Personalized copy based on elapsed time since created_at or last_notified_at
          const lastNotified = sub.last_notified_at ? new Date(sub.last_notified_at) : new Date(sub.created_at);
          const daysSince = Math.floor((Date.now() - lastNotified.getTime()) / (1000 * 60 * 60 * 24));
          
          let bodyText = "Your agent's been waiting for you! 🦞 Play a match now.";
          if (daysSince >= 1) {
            bodyText = `It's been ${daysSince} day${daysSince > 1 ? 's' : ''} since you last played. Your agent is ready for a rematch.`;
          }

          const payload = JSON.stringify({
            title: 'ChessWithClaw',
            body: bodyText,
            url: '/'
          });

          await webpush.sendNotification(sub.subscription, payload);
          
          await supabase.from('push_subscriptions').update({ last_notified_at: new Date().toISOString() }).eq('id', sub.id);
          sentCount++;
        } catch (e) {
          if (e.statusCode === 410 || e.statusCode === 404) {
            // Subscription has expired or is no longer valid
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          } else {
            console.error('Push error:', e);
          }
        }
      }
      return res.status(200).json({ success: true, sent: sentCount });
    }
    if (action === 'resign') {
      if (role === 'human') {
        updates = { status: 'finished', result: 'black_wins', finished_at: now, result_reason: 'resignation' };
        chatText = message || `You have resigned. ${agentName} wins! 🦞`;
        result = 'black_wins';
      } else {
        updates = { status: 'finished', result: 'white_wins', finished_at: now, result_reason: 'resignation' };
        chatText = message || `${agentName} has resigned. Well played! 🦞`;
        result = 'white_wins';
      }
    } else if (action === 'offer_draw') {
      updates = { draw_offer: role, draw_offer_pending: true };
      chatText = message || (role === 'agent' ? `${agentName} offers a draw. Do you accept? 🤝` : `You offered a draw to ${agentName}.`);
    } else if (action === 'accept_draw') {
      updates = { status: 'finished', result: 'draw', draw_offer: null, draw_offer_pending: false, finished_at: now, result_reason: 'agreement' };
      chatText = message || 'Draw accepted. A worthy match! 🦞';
      result = 'draw';
    } else if (action === 'decline_draw') {
      updates = { draw_offer: null, draw_offer_pending: false };
      chatText = message || (role === 'agent' ? `${agentName} declined the draw offer.` : `You declined the draw offer.`);
    } else if (action === 'set_thought_language') {
      const allowedLangs = ['english', 'hindi', 'hinglish', 'simple_english'];
      if (!allowedLangs.includes(value)) {
        return res.status(400).json({ error: 'Invalid language value' });
      }
      updates.thought_language = value;
      chatText = `[System] Thought language set to ${value} 🦞`;
    } else if (action === 'set_board_theme') {
      updates.board_theme = value;
    } else if (action === 'set_piece_style') {
      updates.piece_style = value;
    } else if (action === 'heartbeat') {
      if (role === 'agent') {
        updates = {
          agent_last_seen: now,
          agent_connected: true,
          updated_at: now
        };
        const incomingName = req.headers['x-agent-name'];
        if (incomingName && (!game.agent_name || game.agent_name === 'Your Agent' || game.agent_name === 'Your Agent')) {
          updates.agent_name = incomingName;
        }
      } else {
        updates = {
          player_last_seen: now,
          player_connected: true,
          updated_at: now
        };
      }
    }

    if (chatText) {
      let existingChat = Array.isArray(game.chat_history) ? game.chat_history : [];
      const newChatMsg = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
        role: role,
        text: chatText,
        timestamp: Date.now()
      };
      
      if (action === 'offer_draw') {
        newChatMsg.type = 'draw_offer';
      }
      updates.chat_history = [...existingChat, newChatMsg];
    }

    const { error: updateError } = await supabase.from('games').update(updates).eq('id', gameId);
    if (updateError) {
      console.error('Supabase update error:', updateError);
      return res.status(500).json({ error: 'Database update failed', detail: updateError.message });
    }

    if (action === 'heartbeat') {
      return res.status(200).json({ 
        success: true, 
        alive: true,
        agent_connected: true,
        status: game.status, 
        turn: game.turn, 
        role: role
      });
    }

    return res.status(200).json({ success: true, action, result });
  } catch (err) {
    console.error('Error in action:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
