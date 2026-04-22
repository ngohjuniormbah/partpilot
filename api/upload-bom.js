const { createScanFromUpload } = require('../lib/scan-service');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { fileBase64, filename } = body || {};

    if (!fileBase64) {
      return res.status(400).json({
        ok: false,
        error: 'fileBase64 is required'
      });
    }

    const result = await createScanFromUpload({
      base64: fileBase64,
      filename: filename || 'upload.xlsx'
    });

    return res.status(200).json({
      ok: true,
      scanId: result.scanId,
      status: result.status
    });
  } catch (error) {
    console.error('upload-bom error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to upload BOM'
    });
  }
};