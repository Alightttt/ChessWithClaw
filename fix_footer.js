const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.jsx', 'utf8');

const target = `<footer style={{ marginTop: '120px', position: 'relative' }}>`;
const replacement = `<footer style={{ marginTop: '120px', position: 'relative', paddingBottom: '40px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', marginBottom: '40px', fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontFamily: "'Inter', sans-serif" }}>
          <a href="/legal" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy & Terms</a>
          <a href="https://status.chesswithclaw.vercel.app" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>System Status</a>
          <a href="mailto:support@clawhub.ai" style={{ color: 'inherit', textDecoration: 'none' }}>Contact & Report Abuse</a>
        </div>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/Home.jsx', code);
