const fs = require('fs');
let code = fs.readFileSync('api/new.js', 'utf8');

const target1 = `    // Set cookie with max-age (1 day) & Lax same-site to transfer ownership token securely.
    res.setHeader('Set-Cookie', \`game_owner_\${game.id}=\${secretToken}; Path=/; Max-Age=86400; SameSite=Lax\`);
    res.setHeader('Location', '/created/' + game.id);
    res.status(302).end();`;

const replacement1 = `    if (req.method === 'POST') {
      return res.status(200).json({ gameId: game.id, secretToken });
    }
    // Set cookie with max-age (1 day) & Lax same-site to transfer ownership token securely.
    res.setHeader('Set-Cookie', \`game_owner_\${game.id}=\${secretToken}; Path=/; Max-Age=86400; SameSite=Lax\`);
    res.setHeader('Location', '/created/' + game.id);
    res.status(302).end();`;

code = code.replace(target1, replacement1);

const target2 = `    console.error('Game creation failed on direct new endpoint:', error);
    res.setHeader('Location', '/?error=1');
    res.status(302).end();
    return;`;

const replacement2 = `    console.error('Game creation failed on direct new endpoint:', error);
    if (req.method === 'POST') return res.status(500).json({ error: 'Game creation failed' });
    res.setHeader('Location', '/?error=1');
    res.status(302).end();
    return;`;

code = code.replace(target2, replacement2);

const target3 = `    console.error('Missing or invalid: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    res.setHeader('Location', '/?error=1');
    res.status(302).end();
    return;`;

const replacement3 = `    console.error('Missing or invalid: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    if (req.method === 'POST') return res.status(500).json({ error: 'Missing config' });
    res.setHeader('Location', '/?error=1');
    res.status(302).end();
    return;`;

code = code.replace(target3, replacement3);

const target4 = `  } catch (error) {
    console.error('Create game error on direct new endpoint:', error);
    res.setHeader('Location', '/?error=1');
    res.status(302).end();
  }`;

const replacement4 = `  } catch (error) {
    console.error('Create game error on direct new endpoint:', error);
    if (req.method === 'POST') return res.status(500).json({ error: 'Create game error' });
    res.setHeader('Location', '/?error=1');
    res.status(302).end();
  }`;
  
code = code.replace(target4, replacement4);

fs.writeFileSync('api/new.js', code);
