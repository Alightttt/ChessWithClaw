const fs = require('fs');
let code = fs.readFileSync('api/move.js', 'utf8');

const replacement = `    if (bodyChat && typeof bodyChat === 'string' && bodyChat.trim() !== '') {
      const { data: latestGame } = await supabase.from('games').select('chat_history').eq('id', id).single();
      let existingChat = Array.isArray(latestGame?.chat_history) ? latestGame.chat_history : (Array.isArray(game.chat_history) ? game.chat_history : []);
      const newChatMsg = {`;

code = code.replace(`    if (bodyChat && typeof bodyChat === 'string' && bodyChat.trim() !== '') {
      let existingChat = Array.isArray(game.chat_history) ? game.chat_history : [];
      const newChatMsg = {`, replacement);

fs.writeFileSync('api/move.js', code);
