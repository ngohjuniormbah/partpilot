document.addEventListener('DOMContentLoaded', function () {
  async function fetchJSON(url, options = {}) {
    const response = await fetch(url, options);
    const text = await response.text();

    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (err) {
      throw new Error(text || 'Server returned invalid JSON');
    }

    if (!response.ok) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    return data;
  }

  function getScanId() {
    return new URLSearchParams(window.location.search).get('scanId');
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = function () {
        const result = String(reader.result || '');
        const commaIndex = result.indexOf(',');
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const page = document.body.dataset.page || '';

  // Landing page: demo button
  const demoLink = document.getElementById('demo-load-link');
  if (demoLink) {
    demoLink.addEventListener('click', async function (e) {
      e.preventDefault();

      try {
        demoLink.style.pointerEvents = 'none';
        demoLink.style.opacity = '0.6';

        const data = await fetchJSON('/api/demo-scan');

        if (!data.scanId) {
          throw new Error('Missing scanId from demo response');
        }

        window.location.href = `/processing.html?scanId=${encodeURIComponent(data.scanId)}`;
      } catch (error) {
        console.error('Demo load failed:', error);
        alert(error.message || 'Failed to start demo BOM');
        demoLink.style.pointerEvents = '';
        demoLink.style.opacity = '';
      }
    });
  }

  // Landing page: file upload
  const uploadBox = document.getElementById('upload-box');
  const fileInput = document.getElementById('bom-file-input');

  if (uploadBox && fileInput) {
    uploadBox.addEventListener('click', function () {
      fileInput.click();
    });

    fileInput.addEventListener('change', async function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      try {
        uploadBox.style.pointerEvents = 'none';
        uploadBox.style.opacity = '0.6';

        const fileBase64 = await readFileAsBase64(file);

        const data = await fetchJSON('/api/upload-bom', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filename: file.name,
            fileBase64
          })
        });

        if (!data.scanId) {
          throw new Error('Missing scanId from upload response');
        }

        window.location.href = `/processing.html?scanId=${encodeURIComponent(data.scanId)}`;
      } catch (error) {
        console.error('Upload failed:', error);
        alert(error.message || 'Failed to upload BOM');
        uploadBox.style.pointerEvents = '';
        uploadBox.style.opacity = '';
      }
    });
  }

  // Processing page
  if (page === 'processing') {
    const scanId = getScanId();
    const bar = document.querySelector('.progress-bar');
    const title = document.querySelector('.scan-title');

    if (!scanId) {
      alert('Missing scanId');
      return;
    }

    let progress = 0;
    const timer = setInterval(function () {
      progress = Math.min(progress + 10, 90);
      if (bar) bar.style.width = progress + '%';
    }, 300);

    async function pollStatus() {
      try {
        const data = await fetchJSON(`/api/scan-status?scanId=${encodeURIComponent(scanId)}`);

        if (title) {
          title.textContent = `scan status: ${data.status}...`;
        }

        if (data.status === 'completed') {
          clearInterval(timer);
          if (bar) bar.style.width = '100%';
          window.location.href = `/audit-report.html?scanId=${encodeURIComponent(scanId)}`;
          return;
        }

        if (data.status === 'failed') {
          clearInterval(timer);
          alert('Scan failed');
          return;
        }

        setTimeout(pollStatus, 1200);
      } catch (error) {
        clearInterval(timer);
        console.error('Status check failed:', error);
        alert(error.message || 'Failed to check scan status');
      }
    }

    pollStatus();
  }

  // Audit report page
  if (window.location.pathname.endsWith('/audit-report.html')) {
    const scanId = getScanId();
    if (scanId) {
      fetchJSON(`/api/report?scanId=${encodeURIComponent(scanId)}`)
        .then(function (data) {
          const report = data.report;
          if (!report) return;

          const gradeLetter = document.querySelector('.grade-letter');
          if (gradeLetter) gradeLetter.textContent = report.grade || 'B';

          const summary = document.querySelector('.hero-grade .muted');
          if (summary) summary.textContent = report.summary || '';

          const rowline = document.querySelector('.hero-grade .rowline.tiny');
          if (rowline) {
            rowline.innerHTML = `
              <span>${report.totalParts || 0} parts analyzed</span>
              <span>•</span>
              <span class="count red">${report.criticalCount || 0} critical</span>
              <span>•</span>
              <span class="count amber">${report.warningCount || 0} warnings</span>
            `;
          }

          const alertList = document.querySelector('.alert-list');
          if (alertList && Array.isArray(report.alerts)) {
            alertList.innerHTML = report.alerts.map(function (alert) {
              const isCritical = alert.level === 'critical';
              return `
                <div class="alert-row ${isCritical ? 'red' : 'amber'}">
                  <div class="icon">${isCritical ? '⊘' : '△'}</div>
                  <div class="status-text">${escapeHtml(alert.title || '')}</div>
                  <div class="desc">${escapeHtml(alert.description || '')}</div>
                </div>
              `;
            }).join('');
          }

          const bottomStatus = document.querySelector('.bottom-status');
          if (bottomStatus) {
            bottomStatus.innerHTML = `
              <span>$ BOM Total: <strong>$${Number(report.totalCost || 0).toFixed(2)}</strong></span>
              <span>◫ ${report.totalLines || 0} lines • ${report.totalQuantity || 0} pcs</span>
              <span class="red">◉ ${report.outOfStockCount || 0} out of stock</span>
            `;
          }
        })
        .catch(function (error) {
          console.error('Report load failed:', error);
        });
    }
  }

  // Audit table page
  if (window.location.pathname.endsWith('/audit-table.html')) {
    const scanId = getScanId();
    if (scanId) {
      fetchJSON(`/api/parts?scanId=${encodeURIComponent(scanId)}`)
        .then(function (data) {
          const tbody = document.querySelector('table tbody');
          if (!tbody || !Array.isArray(data.parts)) return;

          tbody.innerHTML = data.parts.map(function (part) {
            const riskClass =
              part.risk_level === 'critical'
                ? 'row-border-red'
                : part.risk_level === 'warning'
                ? 'row-border-amber'
                : '';

            const riskIcon =
              part.risk_level === 'critical'
                ? '⊘'
                : part.risk_level === 'warning'
                ? '△'
                : '◌';

            const riskIconClass =
              part.risk_level === 'critical'
                ? 'stock-red'
                : part.risk_level === 'warning'
                ? 'stock-amber'
                : 'stock-green';

            const lifecycleClass =
              String(part.lifecycle || '').toLowerCase() === 'eol'
                ? 'eol'
                : String(part.lifecycle || '').toLowerCase() === 'nrnd'
                ? 'nrnd'
                : 'active';

            const compliance = Array.isArray(part.compliance)
              ? part.compliance
              : [];

            return `
              <tr class="${riskClass}">
                <td class="${riskIconClass}">${riskIcon}</td>
                <td class="mpn">${escapeHtml(part.mpn || '')}</td>
                <td>${escapeHtml(part.manufacturer || '')}</td>
                <td>${escapeHtml(part.description || '')}</td>
                <td>${part.qty ?? ''}</td>
                <td>${escapeHtml(part.category || '')}</td>
                <td>${escapeHtml(part.package || '')}</td>
                <td><span class="status ${lifecycleClass}">${escapeHtml(part.lifecycle || 'Active')}</span></td>
                <td>${escapeHtml(part.yteol || '—')}</td>
                <td>${part.stock ?? '—'}</td>
                <td>${formatMoney(part.unit_price)}</td>
                <td>${formatMoney(part.ext_price)}</td>
                <td>${escapeHtml(part.trend || '—')}</td>
                <td>${compliance.map(function (item) {
                  return `<span class="comp-badge">${escapeHtml(item)}</span>`;
                }).join(' ')}</td>
              </tr>
            `;
          }).join('');
        })
        .catch(function (error) {
          console.error('Parts load failed:', error);
        });
    }
  }

  document.querySelectorAll('[data-close-monitor]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const card = btn.closest('.monitor-card');
      if (card) card.remove();
    });
  });

  function formatMoney(value) {
    const num = Number(value);
    if (Number.isNaN(num)) return '—';
    return `$${num.toFixed(2)}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});