import express from 'express';
const app = express();
app.get('*all', (req, res) => { console.log('matched *all'); res.send('ok'); });
const req = { url: '/foo', method: 'GET', headers: {} };
const res = { setHeader: () => {}, send: (msg) => console.log('sent:', msg) };
app.handle(req, res, (err) => console.log('next called'));
