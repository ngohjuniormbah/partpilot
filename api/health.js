const { getSupabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('scans')
      .select('id')
      .limit(1);

    if (error) throw error;

    return res.status(200).json({
      ok: true,
      database: 'connected',
      scansReachable: Array.isArray(data)
    });
  } catch (error) {
    console.error('health error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Health check failed'
    });
  }
};