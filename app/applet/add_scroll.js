const fs = require('fs');
let code = fs.readFileSync('src/pages/Game.jsx', 'utf-8');

// 1. Add chatEndRef
code = code.replace(
  'const chatMessagesRef = useRef(null);',
  `const chatMessagesRef = useRef(null);
  const chatEndRef = useRef(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, game?.agent_typing]);`
);

if(!code.includes('const chatEndRef')) {
  // try inserting near start of component
  code = code.replace(
    'const [game, setGame] = useState(null);',
    `const [game, setGame] = useState(null);
    const chatEndRef = useRef(null);
    useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, game?.agent_typing]);`
  );
}

// 2. Add <div ref={chatEndRef} /> inside the chat view
// The message loop is inside `<div ref={chatMessagesRef} ...>`
// We can append `<div ref={chatEndRef} />` before closing this div.
code = code.replace(
  /\{agentTyping && \([\s\S]*?<\/div>\s*\)\}\s*<\/div>/g,
  `{agentTyping && (
              <div style={{ display:'flex', alignItems:'center', gap:'4px', padding:'8px 12px' }}>
                <span style={{fontSize:'11px', color:'#555', marginRight:'4px', fontFamily:'Inter'}}>
                  {agentName}
                </span>
                {['0s','0.15s','0.3s'].map((delay, i) => (
                  <span key={i} style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#555', display:'inline-block', animation:\`typingBounce 1.2s \${delay} ease-in-out infinite\` }} />
                ))}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>`
);

fs.writeFileSync('src/pages/Game.jsx', code, 'utf-8');
