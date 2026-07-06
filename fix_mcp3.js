const fs = require('fs');
let code = fs.readFileSync('api/mcp.js', 'utf8');

const targetHandler = `module.exports = async function handler(req, res) {
  const server = buildServer();

  // Stateless mode (sessionIdGenerator: undefined) + JSON responses:
  // each Vercel invocation is a fresh, short-lived function call, so we
  // don't try to hold an SSE stream open across invocations — every tool
  // call is a normal request/response, which is what Vercel functions are
  // actually good at.
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
};`;

const startIndex = code.indexOf('module.exports = async function handler(req, res) {');
if (startIndex !== -1) {
  const nextCommentIndex = code.indexOf('// Vercel Edge/Node', startIndex);
  if (nextCommentIndex !== -1) {
    const newHandler = `module.exports = async function handler(req) {
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ error: 'This server does not support long-lived SSE streams. Use POST for tool calls, and the wait_for_event tool for waiting on changes.' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const server = buildServer();

  // Stateless mode (sessionIdGenerator: undefined) + JSON responses:
  // each Vercel invocation is a fresh, short-lived function call, so we
  // don't try to hold an SSE stream open across invocations — every tool
  // call is a normal request/response, which is what Vercel functions are
  // actually good at.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(req);
};

`;
    code = code.substring(0, startIndex) + newHandler + code.substring(nextCommentIndex);
    fs.writeFileSync('api/mcp.js', code);
  }
}

