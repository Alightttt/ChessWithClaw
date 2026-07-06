const fs = require('fs');
let code = fs.readFileSync('src/components/LivePlatformActivity/index.jsx', 'utf8');

code = code.replace(
  "const EventTicker = ({ events }) => {",
  "const EventTicker = ({ events }) => {\n  const shouldReduceMotion = useReducedMotion();"
);

code = code.replace(
  "animate={{ y: 0, opacity: 1 }}",
  "animate={{ y: 0, opacity: 1 }}\n              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}"
);
code = code.replace(
  "transition={{ duration: 0.25, ease: 'easeOut' }}",
  ""
); // remove duplicate

fs.writeFileSync('src/components/LivePlatformActivity/index.jsx', code);
