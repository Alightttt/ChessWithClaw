fetch("http://localhost:3000/api/ping", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ id: "123" })
}).then(r => r.text()).then(console.log);
