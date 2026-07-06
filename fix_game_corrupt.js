const fs = require('fs');
let code = fs.readFileSync('src/pages/Game.jsx', 'utf8');

const target = `    const id = setInterval(() => setPresenceTick(t => t + 1), 10000);
      // Screen reader announcements
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');
  useEffect(() => {
    if (game?.status === 'active') {
      setAriaAnnouncement(game.turn === 'w' ? 'White to move' : 'Black to move');
    } else if (game?.status === 'finished') {
      setAriaAnnouncement('Game over. ' + (game.result === 'checkmate' ? 'Checkmate.' : game.result));
    }
  }, [game?.turn, game?.status, game?.result]);

  return (
    <>
      <div aria-live="polite" className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', borderWidth: '0' }}>
        {ariaAnnouncement}
      </div>) => clearInterval(id);
  }, []);`;

const replacement = `    const id = setInterval(() => setPresenceTick(t => t + 1), 10000);
    return () => clearInterval(id);
  }, []);`;

code = code.replace(target, replacement);

fs.writeFileSync('src/pages/Game.jsx', code);
