const { sendJson, withCors, getUrl } = require('../lib/http');
const { getScanBundle, buildDemoScan } = require('../lib/scan-service');

module.exports = async (req, res) => {
  if (withCors(req, res)) return;
  const url = getUrl(req);
  const scanId = url.searchParams.get('scanId');
  const risk = (url.searchParams.get('risk') || '').trim().toLowerCase();
  const lifecycle = (url.searchParams.get('lifecycle') || '').trim().toLowerCase();
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();

  const bundle = scanId ? await getScanBundle(scanId) : await buildDemoScan();
  if (!bundle) {
    return sendJson(res, 404, { ok: false, error: 'Scan not found' });
  }

  let parts = bundle.parts.slice();
  if (risk) parts = parts.filter((part) => String(part.risk).toLowerCase() === risk);
  if (lifecycle) parts = parts.filter((part) => String(part.lifecycle).toLowerCase() === lifecycle);
  if (q) {
    parts = parts.filter((part) =>
      [part.mpn, part.manufacturer, part.description, part.category, part.package].some((value) =>
        String(value || '').toLowerCase().includes(q)
      )
    );
  }

  return sendJson(res, 200, {
    ok: true,
    scanId: bundle.scan.id,
    summary: bundle.scan.summary,
    parts,
  });
};
