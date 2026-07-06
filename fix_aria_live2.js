const fs = require('fs');
let code = fs.readFileSync('src/pages/Game.jsx', 'utf8');

// Insert the hooks before return statement in Game component
const hookInjectionPoint = "  if (loading) {";
const hooks = `  // Screen reader announcements
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');
  useEffect(() => {
    if (game?.status === 'active') {
      setAriaAnnouncement(game.turn === 'w' ? 'White to move' : 'Black to move');
    } else if (game?.status === 'finished') {
      setAriaAnnouncement('Game over. ' + (game.result === 'checkmate' ? 'Checkmate.' : game.result));
    }
  }, [game?.turn, game?.status, game?.result]);

  useEffect(() => {
    if (chatMessages && chatMessages.length > 0) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (lastMsg.role === 'agent') {
        setAriaAnnouncement('Agent says: ' + (lastMsg.text || lastMsg.message || lastMsg.content));
      }
    }
  }, [chatMessages]);

  if (loading) {`;
code = code.replace(hookInjectionPoint, hooks);

// Now wrap the JSX return
const returnTarget = "  return (";
const returnReplacement = `  return (
    <>
      <div aria-live="polite" className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', borderWidth: '0' }}>
        {ariaAnnouncement}
      </div>`;

// Only replace the FIRST occurrence of "  return (" which should be the main render method. 
// Wait, `Game` component might have multiple returns. The first one is for `loading`. The main return is later. 
// Let's find the main return.
