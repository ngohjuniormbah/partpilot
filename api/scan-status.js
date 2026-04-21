const { getScanStatus } = require('../lib/scan-service');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.method !== 'GET') {
      return res.status(405).json({
        ok: false,
        error: 'Method not allowed'
      });
    }

    const { scanId } = req.query;

    if (!scanId) {
      return res.status(400).json({
        ok: false,
        error: 'scanId is required'
      });
    }

    const scan = await getScanStatus(scanId);

    if (!scan) {
      return res.status(404).json({
        ok: false,
        error: 'Scan not found'
      });
    }

    return res.status(200).json({
      ok: true,
      scanId,
      status: scan.status || 'processing'
    });
  } catch (error) {
    console.error('scan-status error:', error);

    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to get scan status'
    });
  }
};