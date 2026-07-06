const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.jsx', 'utf8');

// Add import for LivePlatformActivity
if (!code.includes("import LivePlatformActivity from '../components/LivePlatformActivity';")) {
  code = code.replace("import { Activity, Shield, Terminal, ArrowRight, Play, Server, Layers } from 'lucide-react';", 
    "import { Activity, Shield, Terminal, ArrowRight, Play, Server, Layers } from 'lucide-react';\nimport LivePlatformActivity from '../components/LivePlatformActivity';");
}

// Remove old state and effects for gamesPlayed and ticker
code = code.replace(/const \[gamesPlayed, setGamesPlayed\] = useState\(0\);[\s\S]*?fetchCount\(\);[\s\S]*?const channel = supabase.channel\('public:games'\)[\s\S]*?\.subscribe\(\);[\s\S]*?return \(\) => \{[\s\S]*?supabase\.removeChannel\(channel\);[\s\S]*?\};[\s\S]*?\}, \[\]\);/, "");

code = code.replace(/const \[ticker, setTicker\] = useState\('Someone just beat their agent in 31 moves 🏆'\);[\s\S]*?const RECENT_RESULTS = \[[\s\S]*?\];[\s\S]*?const id = setInterval\(\(\) => \{[\s\S]*?setTicker\(RECENT_RESULTS\[Math\.floor\(Math\.random\(\) \* RECENT_RESULTS\.length\)\]\);[\s\S]*?\}, 4000\);[\s\S]*?return \(\) => clearInterval\(id\);[\s\S]*?\}, \[\]\);/, "");

// Replace the section HTML
const startMarker = '<section className="fade-in-section max-w-7xl mx-auto" style={{ marginBottom: \'64px\', padding: \'0 20px\', marginTop: \'32px\' }}>';
const endMarker = '      <section className="fade-in-section max-w-7xl mx-auto" style={{ marginBottom: \'64px\', padding: \'0 20px\' }}>';

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `<LivePlatformActivity />\n\n`;
  code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
}

fs.writeFileSync('src/pages/Home.jsx', code);
