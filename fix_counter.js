const fs = require('fs');
let code = fs.readFileSync('src/components/LivePlatformActivity/index.jsx', 'utf8');

// Import useReducedMotion
code = code.replace(
  "import { motion, AnimatePresence } from 'framer-motion';",
  "import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';"
);

// Add to Counter component
code = code.replace(
  "const Counter = ({ count, deltaMin, deltaHour }) => {",
  "const Counter = ({ count, deltaMin, deltaHour }) => {\n  const shouldReduceMotion = useReducedMotion();"
);

// Update animate prop
code = code.replace(
  "animate={{ scale: [1.0, 1.08, 1.0] }}",
  "animate={shouldReduceMotion ? { scale: 1 } : { scale: [1.0, 1.08, 1.0] }}"
);

fs.writeFileSync('src/components/LivePlatformActivity/index.jsx', code);
