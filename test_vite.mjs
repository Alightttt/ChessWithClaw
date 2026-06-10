import { createServer } from 'vite';

async function test() {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });
  
  try {
    const mod = await server.ssrLoadModule('/src/pages/Game.jsx');
    console.log("SUCCESS!");
  } catch (e) {
    console.error("ERROR CAUGHT IN VITE:");
    console.error(e.message);
    console.error(e.stack);
  }
  
  await server.close();
}

test();
