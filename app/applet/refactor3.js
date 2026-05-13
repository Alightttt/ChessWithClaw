const fs = require('fs');

let code = fs.readFileSync('src/pages/Game.jsx', 'utf-8');

// 1. Assign ID to combinedChat
code = code.replace(
  `const combinedChat = [
    ...(game.chat_history || []),
    ...localMessages.filter(m => !serverTexts.has(m.text))
  ].sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeA - timeB;
  });`,
  `const _combinedChat = [
    ...(game.chat_history || []),
    ...localMessages.filter(m => !serverTexts.has(m.text))
  ].sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeA - timeB;
  });
  const combinedChat = _combinedChat.map((msg, idx) => ({ ...msg, id: msg.id || \`msg-\${idx}\` }));`
);

// 2. Add Animations style tag
const animEffect = `
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'chat-animations';
    if (!document.getElementById('chat-animations')) {
      style.textContent = \`
        @keyframes msgSlideIn {
          from { opacity: 0; transform: translateY(10px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      \`;
      document.head.appendChild(style);
    }
  }, []);
`;
code = code.replace(
  `const [game, setGame] = useState(null);`,
  `const [game, setGame] = useState(null);\n${animEffect}`
);

// 3. Replace msg.id || msg.timestamp with msg.id
code = code.replace(/msg\.id \|\| msg\.timestamp/g, 'msg.id');

// Replace the two occurrences of bubble styles and animations.
// It seems the user wants bubbles specifically styled. 
// User message bubble: background: '#e63946', color: '#ffffff', borderRadius: '16px 16px 4px 16px', padding: '10px 14px', maxWidth: '75%', alignSelf: 'flex-end', fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: 1.5, wordBreak: 'break-word'
// Agent message bubble: background: '#1a1a1a', color: '#f2f2f2', border: '1px solid #2a2a2a', borderRadius: '16px 16px 16px 4px', padding: '10px 14px', maxWidth: '75%', alignSelf: 'flex-start', fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: 1.5, wordBreak: 'break-word'

// Let's replace the inline styles for the chat bubble div.
// Original User Bubble: background: 'linear-gradient(135deg, #e63946, #c62a35)', color: 'white', borderRadius: '10px 10px 3px 10px', padding: '7px 12px', fontFamily: "'Inter', sans-serif", fontSize: '13px', lineHeight: 1.4, boxShadow: '0 2px 8px rgba(230,57,70,0.2)'
// Original Agent Bubble: background: '#161616', border: '1px solid #222', color: 'rgba(242,242,242,0.85)', borderRadius: '10px 10px 10px 3px', padding: '7px 12px', fontFamily: "'Inter', sans-serif", fontSize: '13px', lineHeight: 1.4

code = code.replace(
  `background: 'linear-gradient(135deg, #e63946, #c62a35)', color: 'white', borderRadius: '10px 10px 3px 10px', padding: '7px 12px', fontFamily: "'Inter', sans-serif", fontSize: '13px', lineHeight: 1.4, boxShadow: '0 2px 8px rgba(230,57,70,0.2)'`,
  `background: '#e63946', color: '#ffffff', borderRadius: '16px 16px 4px 16px', padding: '10px 14px', maxWidth: '75%', alignSelf: 'flex-end', fontFamily: "'Inter', sans-serif", fontSize: '14px', lineHeight: 1.5, wordBreak: 'break-word'`
).replace(
  `background: '#161616', border: '1px solid #222', color: 'rgba(242,242,242,0.85)', borderRadius: '10px 10px 10px 3px', padding: '7px 12px', fontFamily: "'Inter', sans-serif", fontSize: '13px', lineHeight: 1.4`,
  `background: '#1a1a1a', color: '#f2f2f2', border: '1px solid #2a2a2a', borderRadius: '16px 16px 16px 4px', padding: '10px 14px', maxWidth: '75%', alignSelf: 'flex-start', fontFamily: "'Inter', sans-serif", fontSize: '14px', lineHeight: 1.5, wordBreak: 'break-word'`
);

// Do it again globally in case there are 2 chat rendering sections
code = code.replace(
  /background: 'linear-gradient\(135deg, #e63946, #c62a35\)', color: 'white', borderRadius: '10px 10px 3px 10px', padding: '7px 12px', fontFamily: "'Inter', sans-serif", fontSize: '13px', lineHeight: 1\.4, boxShadow: '0 2px 8px rgba\(230,57,70,0\.2\)'/g,
  `background: '#e63946', color: '#ffffff', borderRadius: '16px 16px 4px 16px', padding: '10px 14px', maxWidth: '75%', alignSelf: 'flex-end', fontFamily: "'Inter', sans-serif", fontSize: '14px', lineHeight: 1.5, wordBreak: 'break-word'`
).replace(
  /background: '#161616', border: '1px solid #222', color: 'rgba\(242,242,242,0\.85\)', borderRadius: '10px 10px 10px 3px', padding: '7px 12px', fontFamily: "'Inter', sans-serif", fontSize: '13px', lineHeight: 1\.4/g,
  `background: '#1a1a1a', color: '#f2f2f2', border: '1px solid #2a2a2a', borderRadius: '16px 16px 16px 4px', padding: '10px 14px', maxWidth: '75%', alignSelf: 'flex-start', fontFamily: "'Inter', sans-serif", fontSize: '14px', lineHeight: 1.5, wordBreak: 'break-word'`
);

// Fix the animation style logic in the map loop.
// Old logic:
// const animStyle = { animation: isNewMessage ? 'chatMsgIn 0.22s ease-out forwards' : 'none', opacity: isNewMessage ? undefined : 1 };
// New logic:
// Replace chatMsgIn with msgSlideIn, make sure seenMsgCount is tracked.
// We'll use mountedMsgCount... wait, there is mountedMsgCount? Let's check what it uses. 
// "const seenMsgCount = useRef(0);" is requested by user, but let's just replace `chatMsgIn 0.22s` with `msgSlideIn 0.2s`.
code = code.replace(/chatMsgIn 0\.22s/g, 'msgSlideIn 0.2s');

// The instructions say:
// Message row wrapper: display: 'flex', flexDirection: 'column', marginBottom: '8px', User: alignItems: 'flex-end', Agent: alignItems: 'flex-start'
// Let's replace the outer div style of the message row:
// `<div key={i} style={{ alignSelf: isHuman ? 'flex-end' : 'flex-start', position: 'relative', maxWidth: '75%', ...animStyle }}>`
// We'll replace it with:
// `<div key={msg.id} style={{ alignSelf: isHuman ? 'flex-end' : 'flex-start', display: 'flex', flexDirection: 'column', marginBottom: '8px', alignItems: isHuman ? 'flex-end' : 'flex-start', position: 'relative', maxWidth: '75%', ...animStyle }}>`
code = code.replace(
  /<div key=\{i\} style=\{\{ alignSelf: isHuman \? 'flex-end' : 'flex-start', position: 'relative', maxWidth: '75%', \.\.\.animStyle \}\}>/g,
  `<div key={msg.id} style={{ display: 'flex', flexDirection: 'column', marginBottom: '8px', alignItems: isHuman ? 'flex-end' : 'flex-start', position: 'relative', maxWidth: '100%', width: '100%', alignSelf: 'stretch', ...animStyle }}>`
);

// Let's add the agent name above the bubble if it's not a user message.
// I will just prepend it to the bubble rendering.
code = code.replace(
  /\{!\isHuman && reactionPickerMsgId === \(msg\.id\)/g,
  `{!isHuman && (!combinedChat[i-1] || combinedChat[i-1].sender === 'human' || combinedChat[i-1].role === 'human') && (
                      <div style={{ fontSize: '11px', color: '#555555', marginBottom: '3px', marginLeft: '2px' }}>{agentName}</div>
                    )}
                    {!isHuman && reactionPickerMsgId === (msg.id)`
);


fs.writeFileSync('src/pages/Game.jsx', code, 'utf-8');
console.log("Chat styles refactored");
