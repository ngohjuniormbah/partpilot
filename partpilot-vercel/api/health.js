const { sendJson, withCors } = require('../lib/http');
const { getStoreMode } = require('../lib/db');

module.exports = async (req, res) => {
  if (withCors(req, res)) return;
  const storeMode = await getStoreMode();
  return sendJson(res, 200, {
    ok: true,
    service: 'partpilot-api',
    status: 'healthy',
    storage: storeMode,
    timestamp: new Date().toISOString(),
  });
};
