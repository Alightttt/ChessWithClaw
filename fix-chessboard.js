const fs = require('fs');
let code = fs.readFileSync('src/components/chess/ChessBoard.jsx', 'utf8');

// remove internalArrivedSquare
code = code.replace(/const \[internalArrivedSquare, setInternalArrivedSquare\] = useState\(null\);/g, '');

// remove arrived square internal setting
code = code.replace(/setInternalArrivedSquare\(moveObj\.to\);\n\s*setTimeout\(\(\) => setInternalArrivedSquare\(null\), 150\);/g, '');

code = code.replace(/useEffect\(\(\) => \{\n\s*if \(lastMove\) \{\n\s*const dest = typeof lastMove === 'string' \? lastMove\.substring\(2, 4\) : lastMove\.to;\n\s*setInternalArrivedSquare\(dest\);\n\s*const timer = setTimeout\(\(\) => setInternalArrivedSquare\(null\), 150\);\n\s*return \(\) => clearTimeout\(timer\);\n\s*\}\n\s*\}, \[lastMove\]\);/g, '');

code = code.replace(/internalArrivedSquare/g, 'arrivedSquare'); // fallback just in case

fs.writeFileSync('src/components/chess/ChessBoard.jsx', code);
