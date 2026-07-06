const fs = require('fs');
let code = fs.readFileSync('src/components/LivePlatformActivity/index.jsx', 'utf8');

const target = "if (!events || events.length === 0) {";
const replacement = `const fiveMinutesAgo = new Date(Date.now() - 5 * 60000);
  const activeEvents = events?.filter(ev => new Date(ev.updated_at || ev.created_at) > fiveMinutesAgo) || [];
  
  if (activeEvents.length === 0) {`;

code = code.replace(target, replacement);

const mapTarget = "{events.map((ev) => {";
const mapReplacement = "{activeEvents.map((ev) => {";
code = code.replace(mapTarget, mapReplacement);

fs.writeFileSync('src/components/LivePlatformActivity/index.jsx', code);
