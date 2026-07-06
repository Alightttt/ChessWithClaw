const fs = require('fs');
let code = fs.readFileSync('src/pages/Game.jsx', 'utf8');

const target = `    } catch (e) {
      // Revert board on error
      applyBoardFen(prevBoardFen);
      lastProcessedFenRef.current = prevBoardFen;
      setBoardLastMove(prevBoardLastMove);
      movePendingRef.current = false;
    } finally {`;

const replacement = `    } catch (e) {
      // Revert board on error
      toast.error("Couldn't reach the server. Your move was not processed.");
      applyBoardFen(prevBoardFen);
      lastProcessedFenRef.current = prevBoardFen;
      setBoardLastMove(prevBoardLastMove);
      movePendingRef.current = false;
    } finally {`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/Game.jsx', code);
