import express from 'express';
const app = express();
app.get('*all', (req, res) => res.send('Matched all: ' + req.url));
app.get('/something', (req, res) => res.send('Matched something'));
app.listen(3002, () => console.log('Listening 3002'));
