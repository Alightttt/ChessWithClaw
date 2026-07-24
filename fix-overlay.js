const fs = require('fs');
let code = fs.readFileSync('src/pages/Game.jsx', 'utf8');

const hookCode = `  const [showAgentStatusOverlay, setShowAgentStatusOverlay] = useState(false);
  useEffect(() => {
    let timer;
    if (showAgentStatusOverlay) {
      timer = setTimeout(() => {
        setShowAgentStatusOverlay(false);
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [showAgentStatusOverlay]);`;

code = code.replace("  const [showAgentStatusOverlay, setShowAgentStatusOverlay] = useState(false);", hookCode);
fs.writeFileSync('src/pages/Game.jsx', code);
