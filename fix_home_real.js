const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.jsx', 'utf8');

const hookTarget = `export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();`;

const hookReplacement = `export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const handlePlayNow = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/new', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create game');
      const data = await res.json();
      if (data.gameId) {
        document.cookie = \`game_owner_\${data.gameId}=\${data.secretToken}; Path=/; Max-Age=86400; SameSite=Lax\`;
        localStorage.setItem(\`game_owner_\${data.gameId}\`, data.secretToken);
        navigate(\`/created/\${data.gameId}\`);
      }
    } catch (err) {
      console.error(err);
      if (window.toast) window.toast.error('Failed to create a new game. Please try again.');
      setCreating(false);
    }
  };`;

code = code.replace(hookTarget, hookReplacement);
fs.writeFileSync('src/pages/Home.jsx', code);
