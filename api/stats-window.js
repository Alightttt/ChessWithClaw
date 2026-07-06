const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const minutes = parseInt(req.query.minutes || '60', 10);
  const fromTime = new Date(Date.now() - minutes * 60000).toISOString();
  const toTime = new Date().toISOString();

  try {
    const { count, error } = await supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', fromTime)
      .lte('created_at', toTime);

    if (error) {
      throw error;
    }

    res.status(200).json({ count: count || 0, from: fromTime, to: toTime });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
