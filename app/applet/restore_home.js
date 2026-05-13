const fs = require('fs');

let code = fs.readFileSync('src/pages/Home.jsx', 'utf-8');

if (!code.includes('export default function Home')) {
  code += `\n
export default function Home() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleCreateGame = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/create', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.id) {
        if (data.owner_token) {
          localStorage.setItem(\`game_owner_\${data.id}\`, data.owner_token);
        }
        navigate(\`/game?id=\${data.id}\`);
      } else {
        showToast(data.error || 'Failed to create game', 'error');
      }
    } catch (e) {
      showToast('Network error', 'error');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32 relative">
        {/* HERO */}
        <div className="text-center pt-16 pb-12 relative z-10 w-full max-w-3xl mx-auto">
          <div className="mx-auto w-40 h-40 md:w-56 md:h-56 relative mb-8">
            <ThoughtBubble />
            <img src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" alt="OpenClaw" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight text-white leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
            Play Chess vs <br /><span className="text-[#e63946]">Your OpenClaw</span>
          </h1>
          <p className="text-lg md:text-xl text-neutral-400 mb-10 font-light max-w-2xl mx-auto leading-relaxed">
            A fully autonomous AI agent that plays chess, chats with you, and reacts in real-time. Try to beat the Claw.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleCreateGame}
              disabled={loading}
              className="bg-[#e63946] hover:bg-[#ff4d5a] text-white px-8 py-4 rounded-full font-bold text-lg transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(230,57,70,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[200px]"
            >
              {loading ? 'Starting...' : 'Play Now ➔'}
            </button>
          </div>
        </div>

        {/* FAQs */}
        <div className="max-w-2xl mx-auto mt-32">
          <h2 className="text-2xl font-bold mb-8 text-center text-white" style={{ fontFamily: "'Inter', sans-serif" }}>Frequently Asked Questions</h2>
          <div className="border-t border-[#222]">
            <FAQAccordion question="Is it really autonomous?" answer="Yes. The OpenClaw agent runs in a sandboxed browser, clicking the board and typing messages just like a human player." />
            <FAQAccordion question="How strong is OpenClaw?" answer="The agent can be as strong as Stockfish, but it occasionally makes human-like blunders depending on its mood and your play style." />
          </div>
        </div>
      </div>
    </div>
  );
}
`;
  fs.writeFileSync('src/pages/Home.jsx', code, 'utf-8');
}
