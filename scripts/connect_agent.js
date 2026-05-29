#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Ensure work directory exists
const workDir = '/tmp/cwc';
if (!fs.existsSync(workDir)) {
  fs.mkdirSync(workDir, { recursive: true });
}

const ERROR_LOG_PATH = path.join(workDir, 'errors.log');
const STATE_PATH = path.join(workDir, 'state.json');
const CHATS_PATH = path.join(workDir, 'chats.json');
const STATUS_PATH = path.join(workDir, 'status.txt');
const NEXT_MOVE_PATH = path.join(workDir, 'next_move.json');
const NEXT_CHAT_PATH = path.join(workDir, 'next_chat.json');

function logError(msg) {
  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] ${msg}\n`;
  process.stderr.write(formatted);
  try {
    fs.appendFileSync(ERROR_LOG_PATH, formatted);
  } catch (e) {}
}

function logInfo(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] INFO: ${msg}`);
}

function readCredentials() {
  const creds = { game_id: '', token: '', name: 'OpenClaw' };

  // Parse argv
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--game-id' && args[i + 1]) creds.game_id = args[i + 1];
    if (args[i] === '--token' && args[i + 1]) creds.token = args[i + 1];
    if (args[i] === '--name' && args[i + 1]) creds.name = args[i + 1];
  }

  // Read creds.env
  const credsFile = '/tmp/cwc/creds.env';
  if (fs.existsSync(credsFile)) {
    try {
      const content = fs.readFileSync(credsFile, 'utf8');
      content.split('\n').forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        if (line.includes('=')) {
          let [k, v] = line.split('=');
          k = k.trim().replace('export ', '');
          v = v.trim().replace(/^['"]|['"]$/g, '');
          if (k === 'GAME_ID' || k === 'GAMEID') creds.game_id = creds.game_id || v;
          if (k === 'AGENT_TOKEN' || k === 'TOKEN') creds.token = creds.token || v;
          if (k === 'AGENT_NAME' || k === 'NAME') creds.name = creds.name || v;
        }
      });
    } catch (e) {
      logError(`Error reading creds.env: ${e.message}`);
    }
  }

  // Fallback to env variables
  creds.game_id = creds.game_id || process.env.GAME_ID || '';
  creds.token = creds.token || process.env.AGENT_TOKEN || '';
  creds.name = creds.name || process.env.AGENT_NAME || 'OpenClaw';

  return creds;
}

function makeRequest(url, method = 'GET', headers = {}, payload = null) {
  return new Promise((resolve) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    headers['Content-Type'] = 'application/json';
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: headers,
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ code: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ code: res.statusCode, body: { data } });
        }
      });
    });

    req.on('error', (e) => {
      logError(`Request error in ${method} ${url}: ${e.message}`);
      resolve({ code: 500, body: { error: e.message } });
    });

    if (payload !== null) {
      req.write(JSON.stringify(payload));
    }
    req.end();
  });
}

async function startHeartbeat(baseUrl, gameId, agentToken) {
  logInfo('Starting heartbeat loop...');
  setInterval(async () => {
    const url = `${baseUrl}/api/heartbeat?gameId=${gameId}`;
    const headers = { 'x-agent-token': agentToken };
    const res = await makeRequest(url, 'GET', headers);
    if (res.code !== 200) {
      logError(`Heartbeat failed with code ${res.code}`);
    }
  }, 15000);
}

async function sendGreeting(baseUrl, gameId, agentToken, agentName) {
  const greetingSentFile = '/tmp/cwc/greeting_sent.env';
  if (fs.existsSync(greetingSentFile)) return;

  logInfo(`Sending greeting as ${agentName}...`);
  const url = `${baseUrl}/api/chat`;
  const headers = { 'x-agent-token': agentToken };
  const payload = {
    id: gameId,
    sender: 'agent',
    text: `Gutan Tag! I am ${agentName}, your Chess companion. Let's make this a legendary game! ♟️🦀`,
    role: 'agent'
  };
  const res = await makeRequest(url, 'POST', headers, payload);
  if (res.code === 200) {
    logInfo('Greeting successfully broadcasted!');
    fs.writeFileSync(greetingSentFile, 'true');
  } else {
    logError(`Failed to send greeting: ${JSON.stringify(res.body)}`);
  }
}

async function run() {
  const creds = readCredentials();
  if (!creds.game_id || !creds.token) {
    logError('CRITICAL: Missing GAME_ID or AGENT_TOKEN inside parameters or /tmp/cwc/creds.env!');
    console.log('\nUsage example:');
    console.log('  node connect_agent.js --game-id <UUID> --token <TOKEN> --name <NAME>\n');
    process.exit(1);
  }

  const devUrl = (process.env.DEVELOPMENT_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  logInfo(`Connecting to Game ${creds.game_id} at ${devUrl} as ${creds.name}...`);

  await sendGreeting(devUrl, creds.game_id, creds.token, creds.name);
  startHeartbeat(devUrl, creds.game_id, creds.token);

  // Pre-sync initial state
  logInfo('Fetching initial game state...');
  const resInit = await makeRequest(`${devUrl}/api/state?id=${creds.game_id}`, 'GET');
  if (resInit.code === 200) {
    fs.writeFileSync(STATE_PATH, JSON.stringify(resInit.body, null, 2));
    logInfo('Successfully synchronized initial state!');
  } else {
    logError(`Initial state fetching failed: ${JSON.stringify(resInit.body)}`);
  }

  let lastMoveCount = 0;
  let lastChatCount = 0;

  logInfo('Starting polling loop...');
  let pollingActive = true;
  while (pollingActive) {
    // Check if agent wants to send a chat out of turn
    if (fs.existsSync(NEXT_CHAT_PATH)) {
      try {
        const raw = fs.readFileSync(NEXT_CHAT_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        const text = parsed.text || parsed.message;
        if (text) {
          logInfo(`Sending out-of-turn chat from next_chat.json: ${text}`);
          const headers = { 'x-agent-token': creds.token };
          const payload = {
            id: creds.game_id,
            sender: 'agent',
            text: text,
            role: 'agent'
          };
          await makeRequest(`${devUrl}/api/chat`, 'POST', headers, payload);
        }
        fs.unlinkSync(NEXT_CHAT_PATH);
      } catch (e) {
        logError(`Error sending manual out-of-turn chat: ${e.message}`);
      }
    }

    // Polling request
    const pollUrl = `${devUrl}/api/poll?id=${creds.game_id}&last_move_count=${lastMoveCount}&last_chat_count=${lastChatCount}&agent_name=${encodeURIComponent(creds.name)}`;
    const headers = { 'x-agent-token': creds.token, 'x-agent-name': creds.name };
    const pollRes = await makeRequest(pollUrl, 'GET', headers);

    if (pollRes.code !== 200) {
      logError(`Poll error status code ${pollRes.code}. Retrying in 5s...`);
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }

    const gameData = pollRes.body;
    fs.writeFileSync(STATE_PATH, JSON.stringify(gameData, null, 2));

    const chatHistory = gameData.messages || gameData.chat_history || [];
    fs.writeFileSync(CHATS_PATH, JSON.stringify(chatHistory, null, 2));

    const event = gameData.event;
    const status = gameData.status;

    lastMoveCount = gameData.move_count || lastMoveCount;
    lastChatCount = chatHistory.length;

    if (['game_ended', 'abandoned', 'finished'].includes(event) || ['finished', 'abandoned'].includes(status)) {
      logInfo(`Game Over! Event: ${event}, Status: ${status}, Result: ${gameData.result}`);
      fs.writeFileSync(STATUS_PATH, `GAME_OVER: ${status}`);
      pollingActive = false;
      break;
    }

    if (event === 'your_turn') {
      logInfo(`YOUR TURN! FEN: ${gameData.fen}`);
      fs.writeFileSync(STATUS_PATH, 'YOUR_TURN');

      // Wait until next_move.json is written
      logInfo('Waiting for agent to write next move in /tmp/cwc/next_move.json...');
      let waitingForMove = true;
      while (waitingForMove) {
        if (fs.existsSync(NEXT_MOVE_PATH)) {
          try {
            await new Promise(r => setTimeout(r, 100)); // Sleep 100ms for safety
            const moveRaw = fs.readFileSync(NEXT_MOVE_PATH, 'utf8');
            const moveData = JSON.parse(moveRaw);
            const moveUci = moveData.move;
            const reasoning = moveData.reasoning || moveData.thinking || moveData.thought || moveData.text || '';

            if (moveUci) {
              logInfo(`Submitting move: ${moveUci} (Reason: ${reasoning})`);
              const mHeaders = { 'x-agent-token': creds.token, 'x-agent-name': creds.name };
              const mPayload = {
                id: creds.game_id,
                move: moveUci,
                reasoning: reasoning,
                thinking: reasoning,
                thought: reasoning
              };
              const mRes = await makeRequest(`${devUrl}/api/move`, 'POST', mHeaders, mPayload);
              if (mRes.code === 200) {
                logInfo('Move submitted successfully!');
                fs.unlinkSync(NEXT_MOVE_PATH);
                fs.writeFileSync(STATUS_PATH, 'WAITING_OPPONENT');
                waitingForMove = false;
                break;
              } else {
                logError(`Illegal chess move draft: ${JSON.stringify(mRes.body)}`);
                fs.writeFileSync('/tmp/cwc/move_error.json', JSON.stringify(mRes.body, null, 2));
                fs.unlinkSync(NEXT_MOVE_PATH);
                waitingForMove = false;
                break;
              }
            } else {
              logError('next_move.json content has no move key');
              fs.unlinkSync(NEXT_MOVE_PATH);
              waitingForMove = false;
              break;
            }
          } catch (err) {
            logError(`Error parsing next_move.json: ${err.message}`);
            if (fs.existsSync(NEXT_MOVE_PATH)) {
              fs.unlinkSync(NEXT_MOVE_PATH);
            }
            waitingForMove = false;
            break;
          }
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    } else {
      fs.writeFileSync(STATUS_PATH, 'WAITING_OPPONENT');
    }

    await new Promise(r => setTimeout(r, 3000));
  }
}

run().catch(err => {
  logError(`Fatal run error: ${err.stack || err.message}`);
});
