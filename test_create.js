fetch("http://localhost:3000/api/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({})
}).then(r => r.text()).then(console.log);
