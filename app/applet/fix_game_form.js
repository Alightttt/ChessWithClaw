const fs = require('fs');
let code = fs.readFileSync('src/pages/Game.jsx', 'utf-8');

const regex = /<form\s*onSubmit=\{sendMessage\}[\s\S]*?<\/form>/g;
const newForm = `<form 
            onSubmit={sendMessage} 
            style={{ display: 'flex', gap: '8px', padding: '10px 12px', borderTop: '1px solid #1a1a1a', background: '#0a0a0a' }}
          >
            <input
              id="chat-input"
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Message..."
              autoComplete="off"
              style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '20px', padding: '10px 16px', color: '#f2f2f2', fontFamily: 'Inter', fontSize: '14px', outline: 'none' }}
              disabled={loading || game?.status !== 'active'}
              maxLength={200}
            />
            <button
              type="submit"
              disabled={loading || !chatMessage.trim() || game?.status !== 'active'}
              style={{ background: '#e63946', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px', flexShrink: 0, opacity: (loading || !chatMessage.trim() || game?.status !== 'active') ? 0.5 : 1 }}
            >
              <Send size={16} />
            </button>
          </form>`;

code = code.replace(regex, newForm);
fs.writeFileSync('src/pages/Game.jsx', code, 'utf-8');
