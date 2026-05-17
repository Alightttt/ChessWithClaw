const fs = require('fs');

let content = fs.readFileSync('src/pages/Game.jsx', 'utf8');

const regexDesktop = /<div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>\s*<div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: visibleThought \? '2px' : '0' }}>\s*<span style={{ fontFamily: "'.*?', sans-serif", fontSize: '14px', fontWeight: 600, color: '#f2f2f2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agentName}<\/span>\s*<div style={{ width: '8px', height: '8px', borderRadius: '50%', background: agentConnected \? '#22c55e' : '#444444', boxShadow: agentConnected \? '0 0 6px rgba\(34,197,94,0\.4\)' : 'none', flexShrink: 0, \.\.\.\(agentJustConnected \? { background: '#39d353', width: '10px', height: '10px', transition: 'all 0\.3s' } : {}\) }} \/>\s*<\/div>\s*\{agentDisconnected && \(\s*<div style={{ fontSize: '12px', color: '#888', marginTop: '2px', fontFamily: "'.*?', sans-serif" }}>⚠️ OpenClaw seems idle\.\.\.<\/div>\s*\)\}\s*\{visibleThought && \(\s*<div style={{\s*padding: '12px 16px',\s*color: '#888888',\s*fontSize: '14px',\s*fontFamily: "'.*?', sans-serif",\s*lineHeight: '1\.5',\s*maxWidth: '100%',\s*wordBreak: 'break-word'\s*}}>\s*\{visibleThought\}\s*<\/div>\s*\)\}\s*<\/div>/g;

const replacement = `<div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: visibleThought ? '2px' : '0' }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 600, color: '#f2f2f2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{agentName}</span>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: agentConnected ? '#22c55e' : '#444444', boxShadow: agentConnected ? '0 0 6px rgba(34,197,94,0.4)' : 'none', flexShrink: 0, ...(agentJustConnected ? { background: '#39d353', width: '10px', height: '10px', transition: 'all 0.3s' } : {}) }} />
              {visibleThought && (
                <div style={{ color: 'rgba(242,242,242,0.45)', fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px', flexShrink: 1 }}>
                  {visibleThought}
                </div>
              )}
            </div>
            
            {(!game?.agent_connected && game?.status !== 'finished' && game?.status !== 'abandoned') && (
              <div style={{ fontSize: '11px', color: 'rgba(242,242,242,0.35)', fontFamily: 'Inter, sans-serif', marginTop: '2px' }}>
                Game starts when your OpenClaw joins
              </div>
            )}
            {agentDisconnected && game?.agent_connected && (
               <div style={{ fontSize: '12px', color: '#888', marginTop: '2px', fontFamily: "'Inter', sans-serif" }}>⚠️ OpenClaw seems idle...</div>
            )}
          </div>`;

content = content.replace(regexDesktop, replacement);

fs.writeFileSync('src/pages/Game.jsx', content);
console.log('Fixed agent cards');
