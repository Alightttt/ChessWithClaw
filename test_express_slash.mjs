import express from 'express';
const app = express();
app.all('/api/new', (req, res) => res.send('NO_SLASH'));
app.all('/api/new/', (req, res) => res.send('WITH_SLASH'));
app.listen(3002, () => console.log('Listening 3002'));
