fetch('http://localhost:3000/api/ping', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: '123e4567-e89b-12d3-a456-426614174000' })
}).then(res => res.json()).then(console.log).catch(console.error);
