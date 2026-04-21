const { sendJson, withCors } = require('../lib/http');
const { buildDemoScan } = require('../lib/scan-service');

module.exports = async (req, res) => {
  if (withCors(req, res)) return;
  const { scan } = await buildDemoScan();
  return sendJson(res, 200, {
    ok: true,
    scanId: scan.id,
    status: scan.status,
    redirectUrl: `/audit-report.html?scanId=${encodeURIComponent(scan.id)}`,
  });
};
