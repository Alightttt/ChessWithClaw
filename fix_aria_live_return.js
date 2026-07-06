const fs = require('fs');
let code = fs.readFileSync('src/pages/Game.jsx', 'utf8');

const target = `  return (
    <Layout>`;
const replacement = `  return (
    <>
      <div aria-live="polite" className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', borderWidth: '0' }}>
        {ariaAnnouncement}
      </div>
    <Layout>`;
code = code.replace(target, replacement);

fs.writeFileSync('src/pages/Game.jsx', code);
