const fs = require('fs');
let code = fs.readFileSync('src/lib/supabase.js', 'utf8');

code = code.replace(
  "client = createClient(urlToUse, supabaseAnonKey);",
  "client = createClient(urlToUse, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });"
);

fs.writeFileSync('src/lib/supabase.js', code);
