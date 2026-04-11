const { createClient } = require('@supabase/supabase-js');

async function notifyAgent(game, newPayload, supabase) {
  const payload = { ...newPayload };

  if (payload.game_event) {
    const suggestions = {
      "check_delivered": "You put them in check. React with intensity.",
      "piece_captured": "You lost/gained material. Show emotion.",
      "castled": "Comment on king safety briefly.",
      "checkmate": "Game is over. Final message.",
      "agent_in_check": "You are in check. Acknowledge the pressure.",
      "normal_move": "No chat needed unless it's been 4+ moves since last message."
    };
    const descriptions = {
      "check_delivered": "A check was delivered.",
      "piece_captured": "A piece was captured.",
      "castled": "A castling move was made.",
      "checkmate": "Checkmate was delivered.",
      "agent_in_check": "Agent was put in check.",
      "normal_move": "A normal move was made."
    };
    
    payload.game_event_description = descriptions[payload.game_event] || "A move was made.";
    payload.proactive_chat_suggestion = suggestions[payload.game_event] || suggestions["normal_move"];
  }

  if (game.webhook_url && !game.webhook_failed) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(game.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn(`Webhook failed for game ${game.id} with status ${response.status}`);
        const fails = (game.webhook_fail_count || 0) + 1;
        if (fails >= 3) {
          console.error(`Webhook disabled for game ${game.id} after 3 failures`);
          await supabase.from('games').update({ webhook_failed: true, webhook_fail_count: fails }).eq('id', game.id);
        } else {
          await supabase.from('games').update({ webhook_fail_count: fails }).eq('id', game.id);
        }
      } else {
        if (game.webhook_fail_count > 0) {
          await supabase.from('games').update({ webhook_fail_count: 0 }).eq('id', game.id);
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        console.warn(`Webhook timeout for game ${game.id}`);
      } else {
        console.error(`Webhook error for game ${game.id}:`, e.message);
      }
      const fails = (game.webhook_fail_count || 0) + 1;
      if (fails >= 3) {
        console.error(`Webhook disabled for game ${game.id} after 3 failures`);
        await supabase.from('games').update({ webhook_failed: true, webhook_fail_count: fails }).eq('id', game.id);
      } else {
        await supabase.from('games').update({ webhook_fail_count: fails }).eq('id', game.id);
      }
    }
  }

  return payload;
}

module.exports = async (req, res) => {
  res.status(404).json({ error: 'Not found' });
}

module.exports.notifyAgent = notifyAgent;
