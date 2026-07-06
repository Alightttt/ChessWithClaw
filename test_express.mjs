import express from 'express';
const app = express();
app.get('*all', (req, res) => {
  res.send('Matched ' + req.url);
});
app.listen(3001, () => console.log('Listening on 3001'));
