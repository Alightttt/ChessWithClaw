const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data, error } = await supabase.from('games').select('current_thinking').limit(1);
  console.log("Data:", data);
  console.log("Error:", error);
}
test();
