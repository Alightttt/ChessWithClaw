import express from 'express';
const app = express();
try {
  app.get('*', (req, res) => res.send('ok'));
  console.log('star works');
} catch (e) {
  console.log('star error:', e.message);
}
try {
  app.get('(.*)', (req, res) => res.send('ok'));
  console.log('regex works');
} catch (e) {
  console.log('regex error:', e.message);
}
try {
  app.get('*all', (req, res) => res.send('ok'));
  console.log('*all works');
} catch (e) {
  console.log('*all error:', e.message);
}
