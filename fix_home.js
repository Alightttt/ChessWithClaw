const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.jsx', 'utf8');

const hookTarget = `export default function Home() {
  const navigate = useNavigate();`;

const hookReplacement = `export default function Home() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const handlePlayNow = async (e) => {
    e.preventDefault();
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
      toast.error('Failed to create a new game. Please try again.');
      setCreating(false);
    }
  };`;

code = code.replace(hookTarget, hookReplacement);

// Replace href="/api/new"
code = code.replace(/href="\/api\/new"/g, 'href="#" onClick={handlePlayNow}');

fs.writeFileSync('src/pages/Home.jsx', code);
