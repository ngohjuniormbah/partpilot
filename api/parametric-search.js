const { sendJson, withCors, getUrl } = require('../lib/http');
const { parametricResults } = require('../lib/data');

module.exports = async (req, res) => {
  if (withCors(req, res)) return;
  const url = getUrl(req);
  const category = (url.searchParams.get('category') || 'LDO').trim().toLowerCase();
  const vmax = Number(url.searchParams.get('vmax') || 0);
  const vout = Number(url.searchParams.get('vout') || 0);
  const iout = Number(url.searchParams.get('iout') || 0);
  const noise = Number(url.searchParams.get('noise') || 0);
  const tmin = Number(url.searchParams.get('tmin') || -999);
  const tmax = Number(url.searchParams.get('tmax') || 999);
  const pkg = (url.searchParams.get('package') || '').trim().toLowerCase();

  const results = parametricResults.filter((part) => {
    if (category && String(part.category).toLowerCase() !== category) return false;
    if (vmax && Number(part.vinMax) > vmax) return false;
    if (vout && Number(part.vout) !== vout) return false;
    if (iout && Number(part.ioutMax) < iout) return false;
    if (noise && Number(part.noise) > noise / 1000) return false;
    if (Number(part.tempMin) > tmin) return false;
    if (Number(part.tempMax) < tmax) return false;
    if (pkg && !String(part.package || '').toLowerCase().includes(pkg)) return false;
    return true;
  });

  return sendJson(res, 200, {
    ok: true,
    count: results.length,
    results,
  });
};
