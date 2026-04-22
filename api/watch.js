const { saveWatch } = require('../lib/scan-service');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, scanId } = body || {};

    if (!email) {
      return res.status(400).json({ ok: false, error: 'email is required' });
    }

    await saveWatch({ email, scanId });

    return res.status(200).json({
      ok: true
    });
  } catch (error) {
    console.error('watch error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to save watch request'
    });
  }
};