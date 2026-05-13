const fs = require('fs');

let code = fs.readFileSync('src/pages/Game.jsx', 'utf-8');

// ==== 1. Removals ====
// Remove 'Game [N] with [agentName]' text
code = code.replace(
  /<div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'rgba\(255,255,255,0\.4\)', marginTop: '-2px', marginBottom: '2px' }}>\s*Game \{gameNumber\} with \{agentName\}\s*<\/div>/g,
  ''
);
// In case it wasn't there fully or got mangled:
code = code.replace(/<div[^>]*>\s*Game \{gameNumber\}.*?<\/div>/g, '');

// Also remove gameNumber state and localStorage
code = code.replace(/const gamesWithAgent[\s\S]*?gameNumber[\s\S]*?\]\);/, '');

// Remove any remaining beforeunload
code = code.replace(/window\.addEventListener\('beforeunload'[\s\S]*?window\.removeEventListener\('beforeunload'[\s\S]*?;/g, '');


// ==== 2. Chat Visual Styles & Functional Fixes ====
// We need to inject styles:
const addStyles = `useEffect(() => {
  if (document.getElementById('cwc-chat-styles')) return;
  const s = document.createElement('style');
  s.id = 'cwc-chat-styles';
  s.textContent = \`
    @keyframes msgIn {
      from { opacity: 0; transform: translateY(8px) scale(0.94); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes typingBounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-5px); opacity: 1; }
    }
  \`;
  document.head.appendChild(s);
}, []);`;

// Let's insert addStyles around line: const [game, setGame] = useState(null);
code = code.replace('const [game, setGame] = useState(null);', `const [game, setGame] = useState(null);\n${addStyles}`);

// Track messages
const trackMountCount = `const mountCountRef = useRef(-1);`;
if(!code.includes('const mountCountRef')) {
  code = code.replace('const chatEndRef = useRef(null);', `const chatEndRef = useRef(null);\n  ${trackMountCount}`);
}

// Modify initial fetch to set mountCountRef
code = code.replace(
  'if (data.chat_history) setChatMessages(data.chat_history);',
  `if (data.chat_history) { setChatMessages(data.chat_history); if (mountCountRef.current === -1) mountCountRef.current = data.chat_history.length; }`
);

// Reaction functionality modifications: Add useState for emoji picker
if(!code.includes('openPickerFor')) {
  code = code.replace('const [messageInput, setMessageInput] = useState(\'\');', `const [messageInput, setMessageInput] = useState('');\n  const [openPickerFor, setOpenPickerFor] = useState(null);`);
}

// Ensure toggleReaction function uses unique string IDs
// Actually, I can just rewrite the whole chat section render:

// Locate the chat section:
// {/* D) CHAT SECTION */}
// ... till the end of it ...

// Wait, doing this via regex might be too brittle. I'll read Game.jsx first.
fs.writeFileSync('fix_game_removals.js', code, 'utf-8');
