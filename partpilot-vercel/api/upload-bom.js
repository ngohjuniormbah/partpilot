const { readJsonBody, sendJson, withCors } = require('../lib/http');
const { processBomUpload } = require('../lib/scan-service');

module.exports = async (req, res) => {
  if (withCors(req, res)) return;
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(req, { maxBytes: 10 * 1024 * 1024 });
    const filename = String(body.filename || 'bom.xlsx').trim();
    const contentBase64 = String(body.contentBase64 || '');

    if (!filename || !contentBase64) {
      return sendJson(res, 400, { ok: false, error: 'filename and contentBase64 are required' });
    }

    const buffer = Buffer.from(contentBase64, 'base64');
    if (!buffer.length) {
      return sendJson(res, 400, { ok: false, error: 'Uploaded file is empty' });
    }

    const { scan, parts } = await processBomUpload({ filename, buffer, sourceType: 'upload' });

    return sendJson(res, 201, {
      ok: true,
      scanId: scan.id,
      status: scan.status,
      filename: scan.filename,
      sheetName: scan.sheetName,
      summary: scan.summary,
      grade: scan.grade,
      verdict: scan.verdict,
      partsCount: parts.length,
      redirectUrl: `/audit-report.html?scanId=${encodeURIComponent(scan.id)}`,
    });
  } catch (error) {
    return sendJson(res, 400, {
      ok: false,
      error: 'Failed to process BOM upload',
      details: error.message,
    });
  }
};
