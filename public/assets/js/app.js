document.addEventListener('DOMContentLoaded', function () {
  const state = {
    parts: [],
    report: null,
    activeFilters: {
      risk: null,
      lifecycle: null,
      category: null,
      compliance: null,
      mount: null,
      search: ''
    },
    reportFilters: {
      risk: null,
      search: ''
    }
  };

  function getScanId() {
    return new URLSearchParams(window.location.search).get('scanId');
  }

  async function fetchJSON(url, options = {}) {
    const response = await fetch(url, options);
    const text = await response.text();

    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(text || 'Server returned invalid JSON');
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
    }

    return data;
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatMoney(value, digits = 2) {
    const num = Number(value);
    if (Number.isNaN(num)) return '—';
    return `$${num.toFixed(digits)}`;
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

  function parseCompliance(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {}
      return value.split(',').map(v => v.trim()).filter(Boolean);
    }
    return [];
  }

  function attachGlobalNav() {
    const path = window.location.pathname;
    const scanId = getScanId();

    document.querySelectorAll('.small-link').forEach((el) => {
      const text = (el.textContent || '').trim();

      if (text.includes('Cross-Ref')) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => {
          const url = scanId
            ? `/parametric-search.html?scanId=${encodeURIComponent(scanId)}`
            : '/parametric-search.html';
          window.location.href = url;
        });
      }

      if (text.includes('Audit Log')) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => {
          const report = state.report;
          const parts = state.parts || [];
          const message = report
            ? [
                `Scan ID: ${scanId || 'N/A'}`,
                `Grade: ${report.grade || 'N/A'}`,
                `Critical: ${report.criticalCount || 0}`,
                `Warnings: ${report.warningCount || 0}`,
                `Parts: ${report.totalParts || parts.length || 0}`,
                `Out of stock: ${report.outOfStockCount || 0}`
              ].join('\n')
            : `Scan ID: ${scanId || 'N/A'}\nParts loaded: ${parts.length}`;
          alert(message);
        });
      }
    });

    document.querySelectorAll('.view-toggle button').forEach((btn) => {
      const text = (btn.textContent || '').trim();

      if (text === '▦') {
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', () => {
          if (!path.endsWith('/audit-table.html')) {
            const url = scanId
              ? `/audit-table.html?scanId=${encodeURIComponent(scanId)}`
              : '/audit-table.html';
            window.location.href = url;
          }
        });
      }

      if (text === '☰') {
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', () => {
          if (!path.endsWith('/audit-report.html')) {
            const url = scanId
              ? `/audit-report.html?scanId=${encodeURIComponent(scanId)}`
              : '/audit-report.html';
            window.location.href = url;
          }
        });
      }
    });
  }

  function attachHomepageFlow() {
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              fileBase64
            })
          });

          if (!data.scanId) throw new Error('Missing scanId from upload response');

          window.location.href = `/processing.html?scanId=${encodeURIComponent(data.scanId)}`;
        } catch (error) {
          console.error('Upload error:', error);
          alert(error.message || 'Failed to upload BOM');
          uploadBox.style.pointerEvents = '';
          uploadBox.style.opacity = '';
        }
      });
    }
  }

  function attachProcessingFlow() {
    if (document.body.dataset.page !== 'processing') return;

    const title = document.getElementById('scan-title') || document.querySelector('.scan-title');
    const bar = document.getElementById('progress-bar') || document.querySelector('.progress-bar');
    const scanId = getScanId();
    const demo = new URLSearchParams(window.location.search).get('demo');

    const lines = Array.from(document.querySelectorAll('.term-line'));
    lines.forEach((line, i) => {
      setTimeout(() => {
        line.style.opacity = '1';
        line.style.transform = 'translateY(0)';
      }, 220 + i * 340);
    });

    let progress = 0;
    const timer = setInterval(() => {
      progress = Math.min(progress + 8, 90);
      if (bar) bar.style.width = `${progress}%`;
    }, 300);

    async function boot() {
      try {
        let currentScanId = scanId;

        if (demo === '1' && !currentScanId) {
          if (title) title.textContent = 'creating demo scan...';
          const result = await fetchJSON('/api/demo-scan');
          currentScanId = result.scanId;
          window.history.replaceState({}, '', `/processing.html?scanId=${encodeURIComponent(currentScanId)}`);
        }

        if (!currentScanId) {
          throw new Error('Missing scanId');
        }

        async function poll() {
          const statusData = await fetchJSON(`/api/scan-status?scanId=${encodeURIComponent(currentScanId)}`);
          if (title) title.textContent = `scan status: ${statusData.status}...`;

          if (statusData.status === 'completed') {
            clearInterval(timer);
            if (bar) bar.style.width = '100%';
            setTimeout(() => {
              window.location.href = `/audit-report.html?scanId=${encodeURIComponent(currentScanId)}`;
            }, 500);
            return;
          }

          if (statusData.status === 'failed') {
            clearInterval(timer);
            throw new Error('Scan failed');
          }

          setTimeout(poll, 1200);
        }

        await poll();
      } catch (error) {
        clearInterval(timer);
        console.error('Processing error:', error);
        alert(error.message || 'Processing failed');
      }
    }

    boot();
  }

  function attachWatchButton() {
    const watchButton = document.querySelector('.watch-btn');
    if (!watchButton) return;

    watchButton.addEventListener('click', async () => {
      const input = watchButton.closest('.monitor-form')?.querySelector('input');
      const email = input?.value?.trim();
      const scanId = getScanId();

      if (!email) {
        alert('Enter an email first');
        return;
      }

      try {
        watchButton.disabled = true;
        const originalText = watchButton.textContent;
        watchButton.textContent = 'Saving...';

        await fetchJSON('/api/watch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, scanId })
        });

        input.value = '';
        watchButton.textContent = 'Saved';
        setTimeout(() => {
          watchButton.textContent = originalText;
          watchButton.disabled = false;
        }, 1200);
      } catch (error) {
        console.error('Watch save failed:', error);
        alert(error.message || 'Failed to save watch');
        watchButton.disabled = false;
        watchButton.textContent = 'Watch';
      }
    });
  }

  function hydrateReportPage() {
    if (!window.location.pathname.endsWith('/audit-report.html')) return;

    const scanId = getScanId();
    if (!scanId) return;

    fetchJSON(`/api/report?scanId=${encodeURIComponent(scanId)}`)
      .then((data) => {
        const report = data.report;
        state.report = report;
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

        renderReportAlerts(report.alerts || []);

        const bottomStatus = document.querySelector('.bottom-status');
        if (bottomStatus) {
          bottomStatus.innerHTML = `
            <span>$ BOM Total: <strong>$${Number(report.totalCost || 0).toFixed(2)}</strong></span>
            <span>◫ ${report.totalLines || 0} lines • ${report.totalQuantity || 0} pcs</span>
            <span class="red">◉ ${report.outOfStockCount || 0} out of stock</span>
          `;
        }

        attachReportFilters();
      })
      .catch((error) => {
        console.error('Report load failed:', error);
        alert(error.message || 'Failed to load report');
      });
  }

  function renderReportAlerts(alerts) {
    const alertList = document.querySelector('.alert-list');
    if (!alertList) return;

    let filtered = alerts.slice();

    if (state.reportFilters.risk === 'critical') {
      filtered = filtered.filter((a) => a.level === 'critical');
    }
    if (state.reportFilters.risk === 'warning') {
      filtered = filtered.filter((a) => a.level === 'warning');
    }
    if (state.reportFilters.search) {
      const q = state.reportFilters.search.toLowerCase();
      filtered = filtered.filter((a) =>
        `${a.title || ''} ${a.description || ''}`.toLowerCase().includes(q)
      );
    }

    alertList.innerHTML = filtered
      .map((alert) => {
        const isCritical = alert.level === 'critical';
        return `
          <div class="alert-row ${isCritical ? 'red' : 'amber'}">
            <div class="icon">${isCritical ? '⊘' : '△'}</div>
            <div class="status-text">${escapeHtml(alert.title || '')}</div>
            <div class="desc">${escapeHtml(alert.description || '')}</div>
          </div>
        `;
      })
      .join('');

    if (!filtered.length) {
      alertList.innerHTML = `<div class="alert-row amber"><div class="icon">△</div><div class="status-text">No matching alerts</div><div class="desc">Try clearing your search or filters.</div></div>`;
    }
  }

  function attachReportFilters() {
    if (!window.location.pathname.endsWith('/audit-report.html')) return;

    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        state.reportFilters.search = this.value.trim();
        renderReportAlerts(state.report?.alerts || []);
      });
    }

    document.querySelectorAll('.filter-row .chip').forEach((chip) => {
      const text = (chip.textContent || '').toLowerCase();

      if (text.includes('critical')) {
        chip.style.cursor = 'pointer';
        chip.addEventListener('click', () => {
          state.reportFilters.risk =
            state.reportFilters.risk === 'critical' ? null : 'critical';
          updateChipSelection(chip, state.reportFilters.risk === 'critical');
          clearSiblingChip(chip, 'warning');
          renderReportAlerts(state.report?.alerts || []);
        });
      }

      if (text.includes('warning')) {
        chip.style.cursor = 'pointer';
        chip.addEventListener('click', () => {
          state.reportFilters.risk =
            state.reportFilters.risk === 'warning' ? null : 'warning';
          updateChipSelection(chip, state.reportFilters.risk === 'warning');
          clearSiblingChip(chip, 'critical');
          renderReportAlerts(state.report?.alerts || []);
        });
      }
    });
  }

  function hydrateTablePage() {
    if (!window.location.pathname.endsWith('/audit-table.html')) return;

    const scanId = getScanId();
    if (!scanId) return;

    fetchJSON(`/api/parts?scanId=${encodeURIComponent(scanId)}`)
      .then((data) => {
        state.parts = Array.isArray(data.parts) ? data.parts.map((p) => ({
          ...p,
          compliance: parseCompliance(p.compliance)
        })) : [];

        renderTableParts();
        attachTableFilters();
        updateSidebarCounts();
      })
      .catch((error) => {
        console.error('Parts load failed:', error);
        alert(error.message || 'Failed to load parts');
      });
  }

  function renderTableParts() {
    const tbody = document.querySelector('table tbody');
    if (!tbody) return;

    let filtered = state.parts.slice();

    const q = state.activeFilters.search.toLowerCase();
    if (q) {
      filtered = filtered.filter((part) =>
        [
          part.mpn,
          part.manufacturer,
          part.description,
          part.category,
          part.package,
          part.lifecycle
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    if (state.activeFilters.risk) {
      filtered = filtered.filter((part) => {
        if (state.activeFilters.risk === 'critical') return part.risk_level === 'critical';
        if (state.activeFilters.risk === 'warning') return part.risk_level === 'warning';
        if (state.activeFilters.risk === 'healthy') return part.risk_level === 'healthy';
        return true;
      });
    }

    if (state.activeFilters.lifecycle) {
      filtered = filtered.filter(
        (part) => String(part.lifecycle || '').toLowerCase() === state.activeFilters.lifecycle
      );
    }

    if (state.activeFilters.category) {
      filtered = filtered.filter(
        (part) => String(part.category || '').toLowerCase() === state.activeFilters.category
      );
    }

    if (state.activeFilters.compliance) {
      filtered = filtered.filter((part) =>
        (part.compliance || []).map((v) => String(v).toLowerCase()).includes(state.activeFilters.compliance)
      );
    }

    if (state.activeFilters.mount) {
      filtered = filtered.filter((part) => state.activeFilters.mount === 'smd');
    }

    tbody.innerHTML = filtered
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
          String(part.lifecycle || '').toLowerCase() === 'eol'
            ? 'eol'
            : String(part.lifecycle || '').toLowerCase() === 'nrnd'
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
            <td>${formatMoney(part.unit_price, Number(part.unit_price) < 1 ? 4 : 2)}</td>
            <td>${formatMoney(part.ext_price)}</td>
            <td>${escapeHtml(part.trend || '—')}</td>
            <td>${(part.compliance || []).map((item) => `<span class="comp-badge">${escapeHtml(item)}</span>`).join(' ')}</td>
          </tr>
        `;
      })
      .join('');

    if (!filtered.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="14" style="padding:20px;color:#9aa5b6;">No parts match the current filters.</td>
        </tr>
      `;
    }
  }

  function attachTableFilters() {
    if (!window.location.pathname.endsWith('/audit-table.html')) return;

    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        state.activeFilters.search = this.value.trim();
        renderTableParts();
      });
    }

    document.querySelectorAll('.filter-row .chip').forEach((chip) => {
      const text = (chip.textContent || '').trim().toLowerCase();

      chip.style.cursor = 'pointer';

      chip.addEventListener('click', function () {
        if (text.includes('critical')) toggleExclusiveFilter('risk', 'critical', chip);
        else if (text.includes('warning')) toggleExclusiveFilter('risk', 'warning', chip);
        else if (text.includes('healthy')) toggleExclusiveFilter('risk', 'healthy', chip);
        else if (text.startsWith('active')) toggleExclusiveFilter('lifecycle', 'active', chip);
        else if (text.startsWith('nrnd')) toggleExclusiveFilter('lifecycle', 'nrnd', chip);
        else if (text.startsWith('eol')) toggleExclusiveFilter('lifecycle', 'eol', chip);
        else if (text.startsWith('aec-q100')) toggleExclusiveFilter('compliance', 'aec-q100', chip);
        else if (text.startsWith('reach')) toggleExclusiveFilter('compliance', 'reach', chip);
        else if (text.startsWith('rohs')) toggleExclusiveFilter('compliance', 'rohs', chip);
        else if (text.startsWith('smd')) toggleExclusiveFilter('mount', 'smd', chip);
        else {
          const category = text.replace(/\s+\d+$/, '').trim();
          toggleExclusiveFilter('category', category, chip);
        }

        renderTableParts();
      });
    });
  }

  function toggleExclusiveFilter(group, value, clickedChip) {
    const current = state.activeFilters[group];
    state.activeFilters[group] = current === value ? null : value;

    const chips = Array.from(clickedChip.closest('.filter-row').querySelectorAll('.chip'));
    chips.forEach((chip) => chip.classList.remove('active'));
    if (state.activeFilters[group] === value) {
      clickedChip.classList.add('active');
    }
  }

  function updateChipSelection(chip, isActive) {
    if (isActive) chip.classList.add('active');
    else chip.classList.remove('active');
  }

  function clearSiblingChip(currentChip, siblingKeyword) {
    const siblings = Array.from(currentChip.closest('.filter-row').querySelectorAll('.chip'));
    siblings.forEach((chip) => {
      const txt = (chip.textContent || '').toLowerCase();
      if (txt.includes(siblingKeyword)) chip.classList.remove('active');
    });
  }

  function updateSidebarCounts() {
    if (!window.location.pathname.endsWith('/audit-table.html')) return;

    const all = state.parts;
    const counts = {
      critical: all.filter((p) => p.risk_level === 'critical').length,
      warning: all.filter((p) => p.risk_level === 'warning').length,
      healthy: all.filter((p) => p.risk_level === 'healthy').length,
      active: all.filter((p) => String(p.lifecycle || '').toLowerCase() === 'active').length,
      nrnd: all.filter((p) => String(p.lifecycle || '').toLowerCase() === 'nrnd').length,
      eol: all.filter((p) => String(p.lifecycle || '').toLowerCase() === 'eol').length
    };

    document.querySelectorAll('.chip').forEach((chip) => {
      const text = (chip.textContent || '').toLowerCase();
      if (text.includes('critical')) chip.innerHTML = `Critical ${counts.critical}`;
      if (text.includes('warning')) chip.innerHTML = `Warning ${counts.warning}`;
      if (text.includes('healthy')) chip.innerHTML = `Healthy ${counts.healthy}`;
      if (text === 'active 9' || text.startsWith('active')) chip.innerHTML = `Active ${counts.active}`;
      if (text === 'nrnd 2' || text.startsWith('nrnd')) chip.innerHTML = `NRND ${counts.nrnd}`;
      if (text === 'eol 1' || text.startsWith('eol')) chip.innerHTML = `EOL ${counts.eol}`;
    });
  }

  attachGlobalNav();
  attachHomepageFlow();
  attachProcessingFlow();
  hydrateReportPage();
  hydrateTablePage();
  attachWatchButton();
});