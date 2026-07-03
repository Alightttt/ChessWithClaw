const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('bonds').select('*');
  console.log('Bonds data length:', data.length);
  if (data.length > 0) console.log(data[0]);
}
run();
