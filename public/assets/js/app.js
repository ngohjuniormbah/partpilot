document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;

  async function fetchJSON(url, options = {}) {
    const res = await fetch(url, options);
    const text = await res.text();

    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Server returned non-JSON response: ${text.slice(0, 200)}`);
    }

    if (!res.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
    }

    return data;
  }

  function getScanId() {
    return new URLSearchParams(window.location.search).get('scanId');
  }

  function ensureUploadInput() {
    let input = document.querySelector('#bom-file-input');

    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'bom-file-input';
      input.accept = '.csv,.xls,.xlsx';
      input.style.display = 'none';
      document.body.appendChild(input);
    }

    return input;
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const uploadBox = document.querySelector('.upload-box');
  if (uploadBox) {
    uploadBox.style.cursor = 'pointer';

    uploadBox.addEventListener('click', () => {
      ensureUploadInput().click();
    });

    ensureUploadInput().addEventListener('change', async (e) => {
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

        window.location.href = `/processing.html?scanId=${encodeURIComponent(data.scanId)}`;
      } catch (error) {
        console.error('Upload failed:', error);
        alert(error.message || 'Failed to upload BOM');
        uploadBox.style.pointerEvents = '';
        uploadBox.style.opacity = '';
      }
    });
  }

  const demoLink = document.querySelector('[data-demo-load]');
  if (demoLink) {
    demoLink.addEventListener('click', async (e) => {
      e.preventDefault();

      try {
        demoLink.style.pointerEvents = 'none';
        demoLink.style.opacity = '0.6';

        const data = await fetchJSON('/api/demo-scan');

        if (!data.scanId) {
          throw new Error('demo-scan response missing scanId');
        }

        window.location.href = `/processing.html?scanId=${encodeURIComponent(data.scanId)}`;
      } catch (error) {
        console.error('Demo load failed:', error);
        alert(error.message || 'Failed to start demo scan');
        demoLink.style.pointerEvents = '';
        demoLink.style.opacity = '';
      }
    });
  }

  if (page === 'processing') {
    const bar = document.querySelector('.progress-bar');
    const lines = Array.from(document.querySelectorAll('.term-line'));
    const title = document.querySelector('.scan-title');
    const scanId = getScanId();

    if (!scanId) {
      alert('Missing scanId');
      return;
    }

    let visualProgress = 0;
    const progressTimer = setInterval(() => {
      visualProgress = Math.min(visualProgress + 8, 92);
      if (bar) bar.style.width = `${visualProgress}%`;
    }, 300);

    lines.forEach((line, i) => {
      setTimeout(() => {
        line.style.opacity = '1';
        line.style.transform = 'translateY(0)';
      }, 220 + i * 340);
    });

    async function pollStatus() {
      try {
        const data = await fetchJSON(`/api/scan-status?scanId=${encodeURIComponent(scanId)}`);

        if (title && data.status) {
          title.textContent = `scan status: ${data.status}...`;
        }

        if (data.status === 'completed') {
          clearInterval(progressTimer);
          if (bar) bar.style.width = '100%';

          setTimeout(() => {
            window.location.href = `/audit-report.html?scanId=${encodeURIComponent(scanId)}`;
          }, 500);
          return;
        }

        if (data.status === 'failed') {
          clearInterval(progressTimer);
          throw new Error(data.error || 'Scan failed');
        }

        setTimeout(pollStatus, 1200);
      } catch (error) {
        clearInterval(progressTimer);
        console.error('Scan status error:', error);
        alert(error.message || 'Failed while checking scan status');
      }
    }

    pollStatus();
  }

  document.querySelectorAll('[data-close-monitor]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.monitor-card');
      if (card) card.remove();
    });
  });

  const watchButton = document.querySelector('.watch-btn');
  if (watchButton) {
    watchButton.addEventListener('click', async () => {
      const input = watchButton.closest('.monitor-form')?.querySelector('input');
      const email = input?.value?.trim();
      const scanId = getScanId();

      if (!email) {
        alert('Enter an email first');
        return;
      }

      try {
        await fetchJSON('/api/watch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, scanId })
        });

        alert('Watch saved');
        input.value = '';
      } catch (error) {
        console.error('Watch save failed:', error);
        alert(error.message || 'Failed to save watch');
      }
    });
  }

  async function hydrateReportPage() {
    const scanId = getScanId();
    if (!scanId) return;

    try {
      const data = await fetchJSON(`/api/report?scanId=${encodeURIComponent(scanId)}`);
      const report = data.report;
      if (!report) return;

      const gradeLetter = document.querySelector('.grade-letter');
      if (gradeLetter && report.grade) gradeLetter.textContent = report.grade;

      const muted = document.querySelector('.hero-grade .muted');
      if (muted && report.summary) muted.textContent = report.summary;

      const rowline = document.querySelector('.hero-grade .rowline.tiny');
      if (rowline) {
        rowline.innerHTML = `
          <span>${report.totalParts} parts analyzed</span>
          <span>•</span>
          <span class="count red">${report.criticalCount || 0} critical</span>
          <span>•</span>
          <span class="count amber">${report.warningCount || 0} warnings</span>
        `;
      }

      const alertList = document.querySelector('.alert-list');
      if (alertList && Array.isArray(report.alerts)) {
        alertList.innerHTML = report.alerts
          .map(
            (alert) => `
            <div class="alert-row ${alert.level === 'critical' ? 'red' : 'amber'}">
              <div class="icon">${alert.level === 'critical' ? '⊘' : '△'}</div>
              <div class="status-text">${escapeHtml(alert.title || '')}</div>
              <div class="desc">${escapeHtml(alert.description || '')}</div>
            </div>
          `
          )
          .join('');
      }

      const bottomStatus = document.querySelector('.bottom-status');
      if (bottomStatus) {
        bottomStatus.innerHTML = `
          <span>$ BOM Total: <strong>$${Number(report.totalCost || 0).toFixed(2)}</strong></span>
          <span>◫ ${report.totalLines || 0} lines • ${report.totalQuantity || 0} pcs</span>
          <span class="red">◉ ${report.outOfStockCount || 0} out of stock</span>
        `;
      }
    } catch (error) {
      console.error('Report hydration failed:', error);
      alert(error.message || 'Failed to load report');
    }
  }

  async function hydrateTablePage() {
    const scanId = getScanId();
    if (!scanId) return;

    try {
      const data = await fetchJSON(`/api/parts?scanId=${encodeURIComponent(scanId)}`);
      if (!Array.isArray(data.parts)) return;

      const tbody = document.querySelector('table tbody');
      if (!tbody) return;

      tbody.innerHTML = data.parts
        .map((part) => {
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
            (part.lifecycle || '').toLowerCase() === 'eol'
              ? 'eol'
              : (part.lifecycle || '').toLowerCase() === 'nrnd'
              ? 'nrnd'
              : 'active';

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
              <td>${renderCompliance(part.compliance)}</td>
            </tr>
          `;
        })
        .join('');
    } catch (error) {
      console.error('Parts hydration failed:', error);
      alert(error.message || 'Failed to load parts');
    }
  }

  function renderCompliance(compliance) {
    if (!compliance) return '—';
    const list = Array.isArray(compliance) ? compliance : String(compliance).split(',');
    return list
      .map((item) => `<span class="comp-badge">${escapeHtml(String(item).trim())}</span>`)
      .join('');
  }

  function formatMoney(value) {
    if (value === null || value === undefined || value === '') return '—';
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

  if (window.location.pathname.endsWith('/audit-report.html')) {
    hydrateReportPage();
  }

  if (window.location.pathname.endsWith('/audit-table.html')) {
    hydrateTablePage();
  }
});