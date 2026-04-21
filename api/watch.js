const crypto = require('crypto');
const { readJsonBody, sendJson, withCors } = require('../lib/http');
const { saveWatchSubscription } = require('../lib/db');

module.exports = async (req, res) => {
  if (withCors(req, res)) return;
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const scanId = body.scanId ? String(body.scanId) : null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendJson(res, 400, { ok: false, error: 'Valid email is required' });
    }

    await saveWatchSubscription({
      id: `watch_${crypto.randomUUID().replace(/-/g, '')}`,
      scanId,
      email,
    });

    return sendJson(res, 201, {
      ok: true,
      message: 'Watch subscription saved',
    });
  } catch (error) {
    return sendJson(res, 400, {
      ok: false,
      error: 'Failed to save watch subscription',
      details: error.message,
    });
  }
};
