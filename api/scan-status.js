const { sendJson, withCors, getUrl } = require('../lib/http');
const { getScanBundle } = require('../lib/scan-service');

module.exports = async (req, res) => {
  if (withCors(req, res)) return;
  const url = getUrl(req);
  const scanId = url.searchParams.get('scanId');
  if (!scanId) {
    return sendJson(res, 400, { ok: false, error: 'scanId is required' });
  }
  const bundle = await getScanBundle(scanId);
  if (!bundle) {
    return sendJson(res, 404, { ok: false, error: 'Scan not found' });
  }
  return sendJson(res, 200, {
    ok: true,
    scanId: bundle.scan.id,
    status: bundle.scan.status,
    filename: bundle.scan.filename,
    redirectUrl: `/audit-report.html?scanId=${encodeURIComponent(bundle.scan.id)}`,
  });
};
