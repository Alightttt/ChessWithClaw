const fs = require('fs');
const file = 'src/components/LivePlatformActivity/index.jsx';
let code = fs.readFileSync(file, 'utf8');

const replacement = `  useEffect(() => {
    if (!isInView) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplayValue(count);
      setIsFinished(true);
      return;
    }

    const duration = 1200;
    const initialValue = 0;
    let startTimestamp = null;`;

code = code.replace("  useEffect(() => {\n    if (!isInView) return;\n\n    const duration = 1200;\n    const initialValue = 0;\n    let startTimestamp = null;", replacement);

fs.writeFileSync(file, code);
