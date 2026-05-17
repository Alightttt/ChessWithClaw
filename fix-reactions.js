const fs = require('fs');

function processFile(f) {
  if (!fs.existsSync(f)) return;
  let content = fs.readFileSync(f, 'utf8');

  // Replace handlers logic
  content = content.replace(/const handleMsgTouchStart = .*?\n.*?\n.*?\n.*?\n.*?};\n\n.*?handleMsgTouchEnd.*?\n.*?\n.*?\n.*?\n.*?\n.*?};/s, 
`const handleMsgTouchStart = (msgId) => {
    longPressTimer.current = setTimeout(() => {
      setActivePickerMsgId(msgId);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 500); 
  };

  const handleMsgTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleMsgTouchMove = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };`);

  // Touch handlers
  content = content.replace(/onTouchStart=\{.*?handleMsgTouchStart\(msg\.id\).*?\}/s, `onTouchStart={() => handleMsgTouchStart(msg.id)}`);
  content = content.replace(/onTouchEnd=\{.*?handleMsgTouchEnd\(msg\.id\).*?\}/s, `onTouchEnd={handleMsgTouchEnd}\n                onTouchMove={handleMsgTouchMove}`);
  
  // onClick 
  content = content.replace(/onClick=\{\(e\) => \{\s*if \(isAgent\) \{\s*e\.stopPropagation\(\);\s*\/\/\s*Desktop: click shows picker\s*setActivePickerMsgId\(prev =>\s*prev === msg\.id \? null : msg\.id\s*\);\s*\}\s*\}\}/s, 
  `onContextMenu={(e) => {
                  if (isAgent) {
                    e.preventDefault();
                    e.stopPropagation();
                    // Desktop: right-click shows picker
                    setActivePickerMsgId(msg.id);
                  }
                }}`);

  // Picker positioning
  content = content.replace(/\{\/\* Full reaction picker \(long press \/ desktop click\) \*\/\}.*?\{isAgent && activePickerMsgId === msg\.id && \(\s*<div\s*onClick=\{e => e\.stopPropagation\(\)\}\s*style=\{\{\s*position: 'absolute',\s*bottom: 'calc\(100% \+ 6px\)',\s*left: '0',\s*display: 'flex',\s*gap: '4px',\s*background: '#1c1c1c',\s*border: '1px solid #2a2a2a',\s*borderRadius: '100px',\s*padding: '8px 12px',\s*boxShadow: '0 4px 12px rgba\(0,0,0,0\.5\)',\s*zIndex: 10\s*\}\}\s*>\s*\{.*?\.map.*?\s*<button.*?<\/button>\s*\)\}\s*<\/div>\s*\)\}/s,
  `{/* Full reaction picker (long press / desktop right click) */}
              {isAgent && activePickerMsgId === msg.id && (
                <div
                  style={{
                    display: 'flex', gap: '4px',
                    background: '#1c1c1c', border: '1px solid #2a2a2a',
                    borderRadius: '100px', padding: '8px 12px',
                    marginTop: '6px',
                    alignSelf: 'flex-start',
                    animation: 'pickerIn 0.15s ease-out'
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {['❤️', '😂', '🔥', '😮', '😅', '👏'].map(emoji => (
                    <button key={emoji} onClick={() => sendReaction(msg.id, emoji)}
                      style={{background:'none',border:'none',cursor:'pointer',
                              fontSize:'20px',padding:'2px',lineHeight:1}}>
                      {emoji}
                    </button>
                  ))}
                </div>
              )}`);
              
  fs.writeFileSync(f, content);
}

['src/pages/Game.jsx', 'src/pages/Agent.jsx'].forEach(processFile);
