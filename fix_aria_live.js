const fs = require('fs');
let code = fs.readFileSync('src/pages/Game.jsx', 'utf8');

const target = "return (";
const replacement = `  // Screen reader announcements
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
      </div>`;

code = code.replace(target, replacement);

const target2 = `  const lastMoveHistoryRef = useRef(null);`;
const replacement2 = `  const lastMoveHistoryRef = useRef(null);
  useEffect(() => {
    if (chatMessages && chatMessages.length > 0) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (lastMsg.role === 'agent') {
        setAriaAnnouncement('Agent says: ' + (lastMsg.text || lastMsg.message || lastMsg.content));
      }
    }
  }, [chatMessages]);`;

code = code.replace(target2, replacement2);
code = code.replace("</Layout>", "</Layout>\n    </>"); // close the Fragment

fs.writeFileSync('src/pages/Game.jsx', code);
