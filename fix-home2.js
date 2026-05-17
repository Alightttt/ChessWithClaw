const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.jsx', 'utf8');

// 1. Add header pills
code = code.replace(/<button \n\s*onClick=\{handleStart\}\s*\n\s*disabled=\{creating\}\n\s*className="design-btn-nav"\n\s*>/g, 
`<div className="hidden md:flex items-center gap-3 mr-4">
            <a href="https://x.com/0xalyt" target="_blank" rel="noopener noreferrer" className="design-btn-secondary" style={{ height: '36px', padding: '0 16px', fontSize: '13px', borderRadius: '100px', background: 'rgba(255,255,255,0.03)' }}>x.com/0xalyt</a>
            <a href="https://x.com/0xalyt" target="_blank" rel="noopener noreferrer" className="design-btn-secondary" style={{ height: '36px', padding: '0 16px', fontSize: '13px', borderRadius: '100px', background: 'rgba(255,255,255,0.03)' }}>x.com/0xalyt</a>
          </div>
          <button 
          onClick={handleStart} 
          disabled={creating}
          className="design-btn-nav"
        >`);

// 2. Change section to grid md:grid-cols-2
code = code.replace(/className="flex flex-col items-center max-w-7xl mx-auto"/, 'className="flex flex-col md:grid md:grid-cols-2 items-center max-w-7xl mx-auto gap-12 md:gap-8"');
code = code.replace(/className="flex-1 flex flex-col items-center text-center z-10 w-full"/, 'className="flex-1 flex flex-col items-center md:items-start text-center md:text-left z-10 w-full"');

// 3. Move the chessboard into a separate right column div instead of inside the left column.
code = code.replace(/<motion\.div \n\s*initial=\{\{ opacity: 0, y: 40 \}\}\n\s*animate=\{\{ opacity: 1, y: 0 \}\}\n\s*transition=\{\{ duration: 0\.8, delay: 0\.3, ease: \[0\.16, 1, 0\.3, 1\] \}\}\n\s*className="w-full z-10 mx-auto"\n\s*style=\{\{ maxWidth: '360px', position: 'relative' \}\}\n\s*>\n\s*<div style=\{\{ padding: '8px', background: '#111111', border: '1px solid #1e1e1e', borderRadius: '12px', filter: 'drop-shadow\(0 0 40px rgba\(230,57,70,0\.15\)\)' \}\}>\n\s*<div className="flex items-center justify-between mb-3 px-2 relative" style=\{\{ position: 'relative' \}\}>\n\s*<div className="flex items-center gap-2">\n\s*<span className="text-xl"><LobsterEmoji \/><\/span>\n\s*<span style=\{\{ fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 600, color: '#f2f2f2' \}\}>OpenClaw<\/span>\n\s*<\/div>\n\s*<ThoughtBubble \/>\n\s*<\/div>\n\s*<div \n\s*style=\{\{ width: '100%', aspectRatio: '1\/1', overflow: 'hidden', borderRadius: '4px' \}\}\n\s*>\n\s*<div style=\{\{ pointerEvents: 'none' \}\}>\n\s*<ChessBoard fen="r2qr1k1\/1p3p1p\/p2p2p1\/3P1b2\/P1p1N3\/5Q2\/1PP2PPP\/R3R1K1 w - - 0 20" interactive=\{false\} showCoordinates=\{false\} boardTheme="green" pieceTheme="neo" \/>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*<\/motion\.div>/, '');

code = code.replace(/<\/section>/, `  </div>
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full z-10 mx-auto mt-12 md:mt-0"
            style={{ maxWidth: '440px', position: 'relative' }}
          >
            <div style={{ padding: '12px', background: '#111111', border: '1px solid #1e1e1e', borderRadius: '16px', filter: 'drop-shadow(0 0 50px rgba(230,57,70,0.2))' }}>
              <div className="flex items-center justify-between mb-4 px-2" style={{ position: 'relative' }}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl"><LobsterEmoji /></span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 600, color: '#f2f2f2' }}>OpenClaw</span>
                </div>
                <ThoughtBubble />
              </div>
              <div 
                style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden', borderRadius: '6px' }}
              >
                <div style={{ pointerEvents: 'none' }}>
                  <ChessBoard fen="r2qr1k1/1p3p1p/p2p2p1/3P1b2/P1p1N3/5Q2/1PP2PPP/R3R1K1 w - - 0 20" interactive={false} showCoordinates={false} boardTheme="green" pieceTheme="neo" />
                </div>
              </div>
            </div>
          </motion.div>
      </section>`);

// Also align elements nicely md:items-start md:text-left
code = code.replace(/className="flex flex-col sm:flex-row items-center justify-center w-full sm:w-auto"/, 'className="flex flex-col sm:flex-row items-center justify-center md:justify-start w-full sm:w-auto"');
code = code.replace(/margin: '0 auto',/, "margin: '0 auto', /* md handled via media query normally but okay */");

fs.writeFileSync('src/pages/Home.jsx', code);
