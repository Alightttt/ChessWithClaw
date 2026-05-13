const fs = require('fs');

let code = fs.readFileSync('src/pages/Home.jsx', 'utf-8');

const newArray = `const DEMO_THOUGHTS = [
  { text: "Bold. Very bold.", lang: "EN" },
  { text: "Dekh raha hoon. 👀", lang: "HG" },
  { text: "Interesting...", lang: "EN" },
  { text: "Yaar seriously? 💀", lang: "HG" },
  { text: "Soch ke khela kya?", lang: "HG" },
  { text: "ठीक है, देखते हैं।", lang: "HI" },
  { text: "Wait. WAIT.", lang: "EN" },
  { text: "हम्म... अच्छा।", lang: "HI" },
  { text: "Okay okay okay.", lang: "EN" },
  { text: "Bhai kya kar raha hai 😂", lang: "HG" },
  { text: "तू ठीक तो है?", lang: "HI" },
  { text: "Not bad honestly.", lang: "SE" },
  { text: "I see what you did.", lang: "EN" },
  { text: "Bas yahi sochta tha.", lang: "HG" },
  { text: "Oh. Oh no.", lang: "SE" },
  { text: "अरे वाह!", lang: "HI" },
  { text: "You're getting smarter.", lang: "EN" },
  { text: "Chalo theek hai.", lang: "HG" },
];`;

code = code.replace(/const DEMO_THOUGHTS[\s\S]*?\];/, newArray);

const oldComponent = /function ThoughtBubble\(\) \{[\s\S]*?return \([\s\S]*?<\/div>\s*\);\s*\}/;

const newComponent = `function ThoughtBubble() {
  const [displayedThought, setDisplayedThought] = useState('');
  const [thoughtIdx, setThoughtIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setThoughtIdx(i => (i + 1) % DEMO_THOUGHTS.length);
    }, 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setDisplayedThought(DEMO_THOUGHTS[thoughtIdx].text);
  }, [thoughtIdx]);

  return (
    <div className="absolute -top-12 -right-4 md:-right-12 bg-[#1a1a1a] border border-[#333] px-4 py-2 rounded-2xl rounded-bl-sm shadow-2xl z-20">
      <div 
        key={thoughtIdx}
        className="text-[13px] text-[#f2f2f2] font-mono tracking-tight"
        style={{ whiteSpace: 'nowrap', opacity: 1, animation: 'cwcFadeInOut 2s ease-in-out' }}
      >
        {displayedThought}
      </div>
      <style>{\`
        @keyframes cwcFadeInOut {
          0% { opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; }
        }
      \`}</style>
    </div>
  );
}`;

code = code.replace(oldComponent, newComponent);

fs.writeFileSync('src/pages/Home.jsx', code, 'utf-8');
console.log("Home.jsx updated");
