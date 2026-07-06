const fs = require('fs');
let code = fs.readFileSync('src/components/LivePlatformActivity/index.jsx', 'utf8');

code = code.replace(
  "const { count, activeNow, lastCheckmate, recentEvents, deltaHour, deltaMin } = useLiveActivity();",
  "const { count, activeNow, lastCheckmate, recentEvents, deltaHour, deltaMin, elementRef } = useLiveActivity();"
);

code = code.replace(
  '<section className={styles.section} aria-label="Live Platform Activity">',
  '<section ref={elementRef} className={styles.section} aria-label="Live Platform Activity">'
);

fs.writeFileSync('src/components/LivePlatformActivity/index.jsx', code);
