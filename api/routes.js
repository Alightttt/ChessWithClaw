module.exports = async function handler(req, res) {
  res.json({ routes: req.app._router.stack.map(l => l.route?.path).filter(Boolean) });
}
