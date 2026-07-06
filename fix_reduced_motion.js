const fs = require('fs');
let code = fs.readFileSync('src/components/chess/ChessBoard.jsx', 'utf8');

// Import useReducedMotion
code = code.replace(
  "import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';",
  "import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';\nimport { useReducedMotion } from 'framer-motion';"
);

// Add to component
code = code.replace(
  "  const [promotionSquare, setPromotionSquare] = useState(null);",
  "  const [promotionSquare, setPromotionSquare] = useState(null);\n  const shouldReduceMotion = useReducedMotion();"
);

// Update animationDuration
code = code.replace(
  "animationDuration={200}",
  "animationDuration={shouldReduceMotion ? 0 : 200}"
);

fs.writeFileSync('src/components/chess/ChessBoard.jsx', code);
