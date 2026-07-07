const fs = require('fs');
let code = fs.readFileSync('api/new.js', 'utf8');

const target = `    if (error || !game) {
      console.error('Game creation failed on direct new endpoint:', error);
      res.setHeader('Location', '/?error=1');
      res.status(302).end();
      return;
    }`;

const replacement = `    if (error || !game) {
      console.error('Game creation failed on direct new endpoint:', error);
      if (req.method === 'POST') return res.status(500).json({ error: 'Game creation failed' });
      res.setHeader('Location', '/?error=1');
      res.status(302).end();
      return;
    }`;

code = code.replace(target, replacement);

fs.writeFileSync('api/new.js', code);
