const fs = require('fs');

const lobsterComp = `const LobsterEmoji = () => <span style={{fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', fontStyle:'normal'}}>🦞</span>;`;

function processFile(f) {
  if (!fs.existsSync(f)) return;
  let content = fs.readFileSync(f, 'utf8');
  if (!content.includes('LobsterEmoji')) {
    // insert after imports
    content = content.replace(/(import .*;\n)+/, (match) => match + '\n' + lobsterComp + '\n\n');
  }

  // JSX text replacements safely
  content = content.replace(/>🦞</g, '><LobsterEmoji /><');
  content = content.replace(/\{'🦞'\}/g, '<LobsterEmoji />');
  
  // replace inside strings that are inside JSX text... maybe just manual is safer for some.
  // "Summon Your OpenClaw 🦞"
  content = content.replace(/>Summon Your OpenClaw 🦞</g, '>Summon Your OpenClaw <LobsterEmoji /><');
  // "🦞 Your game with "
  content = content.replace(/'🦞 Your game with '/g, '<><LobsterEmoji /> Your game with </>');
  content = content.replace(/>🦞 Your game with /g, '><LobsterEmoji /> Your game with ');
  
  // In GameCreated.jsx: toast.success(`${...} 🦞`)
  content = content.replace(/toast\.success\(`\$\{payload.new.agent_name \|\| 'Your OpenClaw'\} has joined! 🦞`\)/g, 
    "toast.success(<>{payload.new.agent_name || 'Your OpenClaw'} has joined! <LobsterEmoji /></>)");
    
  // Home.jsx feature icon
  content = content.replace(/icon: \(\) => <span className="text-2xl">🦞<\/span>/g,
    'icon: () => <span className="text-2xl"><LobsterEmoji /></span>');

  // Game.jsx / Agent.jsx result toast
  content = content.replace(/\? '🤝' : '🦞'\}/g, "? '🤝' : <LobsterEmoji />}");
  // 'Well played. Your OpenClaw salutes you. 🦞' -> <>Well played. Your OpenClaw salutes you. <LobsterEmoji /></>
  content = content.replace(/'Well played\. Your OpenClaw salutes you\. 🦞'/g, "<>Well played. Your OpenClaw salutes you. <LobsterEmoji /></>");
  
  // ChatBox.jsx displayAvatar
  content = content.replace(/const displayAvatar = agentAvatar \|\| '🦞';/g, "const displayAvatar = agentAvatar || <LobsterEmoji />;");

  // Game.jsx / Agent.jsx toast icon: '🦞',
  content = content.replace(/icon: '🦞',/g, "icon: <LobsterEmoji />,");

  fs.writeFileSync(f, content);
}

['src/pages/Game.jsx', 'src/pages/Agent.jsx', 'src/pages/Home.jsx', 'src/components/GameCreated.jsx', 'src/components/chess/ChatBox.jsx'].forEach(processFile);
