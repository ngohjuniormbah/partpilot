const { sendJson, withCors, getUrl } = require('../lib/http');
const { getScanBundle, buildDemoScan } = require('../lib/scan-service');

module.exports = async (req, res) => {
  if (withCors(req, res)) return;
  const url = getUrl(req);
  const scanId = url.searchParams.get('scanId');

  const bundle = scanId ? await getScanBundle(scanId) : await buildDemoScan();
  if (!bundle) {
    return sendJson(res, 404, { ok: false, error: 'Scan not found' });
  }

  return sendJson(res, 200, {
    ok: true,
    scanId: bundle.scan.id,
    filename: bundle.scan.filename,
    grade: bundle.scan.grade,
    verdict: bundle.scan.verdict,
    summary: bundle.scan.summary,
    alerts: bundle.scan.alerts,
    status: bundle.scan.status,
    metadata: bundle.scan.metadata,
  });
};
