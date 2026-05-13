const fs = require('fs');

let code = fs.readFileSync('api/chat.js', 'utf-8');

// 1. Add generateId helper
code = code.replace(
  "const { applySecurityHeaders, applyCacheControl, applyRateLimitHeaders, applyCorsHeaders } = require('../server-lib/middleware/headers.js');",
  `const { applySecurityHeaders, applyCacheControl, applyRateLimitHeaders, applyCorsHeaders } = require('../server-lib/middleware/headers.js');\nconst generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);`
);

// 2. new message formatting and history processing
let targetNewMessage = `  const existing = Array.isArray(gameRow?.chat_history) ? gameRow.chat_history : [];
  const newMsg = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
    role: sender,
    text: text,
    timestamp: Date.now()
  };

  const newHistory = [...existing, newMsg];`;

let replaceNewMessage = `  const existingHistory2 = Array.isArray(gameRow?.chat_history) ? gameRow.chat_history : [];
  const existing = (existingHistory2 || []).map((msg, i) => ({
    ...msg,
    id: msg.id || \`legacy-\${i}\`
  }));
  const newMsg = {
    id: generateId(),
    role: sender,
    message: sanitizedText,
    timestamp: new Date().toISOString(),
    reactions: {}
  };

  const newHistory = [...existing, newMsg];`;

code = code.replace(targetNewMessage, replaceNewMessage);

fs.writeFileSync('api/chat.js', code, 'utf-8');
console.log("chat.js modified");
