const fs = require('fs');
let code = fs.readFileSync('src/components/LivePlatformActivity/index.jsx', 'utf8');

const target = `    if (count > prevCount.current) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(timer);
    }`;

const replacement = `    if (count > prevCount.current) {
      setFlash(true);
      let startTime = null;
      let rAF = null;
      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = timestamp - startTime;
        if (progress > 600) {
          setFlash(false);
        } else {
          rAF = requestAnimationFrame(animate);
        }
      };
      rAF = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(rAF);
    }`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/LivePlatformActivity/index.jsx', code);
