document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'partpilot.activeScanId';
  const pathname = window.location.pathname;
  const currentScanId = getActiveScanId();

  setupDemoLinks();
  setupUploadBox();
  setupProcessingPage();
  setupReportPage();
  setupTablePage();
  setupParametricSearch();
  setupWatchForm(currentScanId);

  function getActiveScanId() {
    const url = new URL(window.location.href);
    const scanId = url.searchParams.get('scanId');
    if (scanId) {
      localStorage.setItem(STORAGE_KEY, scanId);
      return scanId;
    }
    return localStorage.getItem(STORAGE_KEY);
  }

  function setActiveScanId(scanId) {
    if (scanId) localStorage.setItem(STORAGE_KEY, scanId);
  }

  function setupDemoLinks() {
    document.querySelectorAll('[data-demo-load]').forEach((el) => {
      el.addEventListener('click', async (event) => {
        event.preventDefault();
        try {
          const response = await fetch('/api/demo-scan');
          const payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Failed to load demo scan');
          setActiveScanId(payload.scanId);
          window.location.href = `/processing.html?scanId=${encodeURIComponent(payload.scanId)}`;
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function setupUploadBox() {
    const uploadBox = document.querySelector('.upload-box');
    if (!uploadBox) return;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,.xls,.xlsx';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    uploadBox.style.cursor = 'pointer';
    uploadBox.addEventListener('click', () => fileInput.click());
    uploadBox.addEventListener('dragover', (event) => {
      event.preventDefault();
      uploadBox.style.borderColor = 'rgba(55,209,118,.8)';
    });
    uploadBox.addEventListener('dragleave', () => {
      uploadBox.style.borderColor = '';
    });
    uploadBox.addEventListener('drop', async (event) => {
      event.preventDefault();
      uploadBox.style.borderColor = '';
      const file = event.dataTransfer?.files?.[0];
      if (file) await uploadBomFile(file);
    });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (file) await uploadBomFile(file);
      fileInput.value = '';
    });

    async function uploadBomFile(file) {
      try {
        setUploadState('Uploading and analyzing BOM...');
        const contentBase64 = await readFileAsBase64(file);
        const response = await fetch('/api/upload-bom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, contentBase64 }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.details || payload.error || 'Upload failed');
        setActiveScanId(payload.scanId);
        window.location.href = `/processing.html?scanId=${encodeURIComponent(payload.scanId)}`;
      } catch (error) {
        setUploadState(error.message, true);
      }
    }

    function setUploadState(message, isError = false) {
      const title = uploadBox.querySelector('.upload-title');
      const sub = uploadBox.querySelector('.upload-sub');
      if (title) title.textContent = isError ? 'Upload failed' : 'BOM received';
      if (sub) sub.textContent = message;
    }
  }

  function setupProcessingPage() {
    if (!pathname.endsWith('/processing.html')) return;
    const scanId = currentScanId || new URL(window.location.href).searchParams.get('scanId');
    const bar = document.querySelector('.progress-bar');
    const lines = Array.from(document.querySelectorAll('.term-line'));

    setTimeout(() => bar && (bar.style.width = '100%'), 80);
    lines.forEach((line, index) => {
      setTimeout(() => {
        line.style.opacity = '1';
        line.style.transform = 'translateY(0)';
      }, 220 + index * 340);
    });

    if (!scanId) {
      setTimeout(() => {
        window.location.href = '/audit-report.html';
      }, 2600);
      return;
    }

    const poll = async () => {
      try {
        const response = await fetch(`/api/scan-status?scanId=${encodeURIComponent(scanId)}`);
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Scan polling failed');
        if (payload.status === 'completed') {
          setTimeout(() => {
            window.location.href = payload.redirectUrl;
          }, 1200);
          return;
        }
      } catch (error) {
        console.error(error);
      }
      setTimeout(poll, 1200);
    };
    setTimeout(poll, 2500);
  }

  async function setupReportPage() {
    if (!pathname.endsWith('/audit-report.html')) return;
    try {
      const response = await fetch(currentScanId ? `/api/report?scanId=${encodeURIComponent(currentScanId)}` : '/api/report');
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Failed to load report');
      setActiveScanId(payload.scanId);
      hydrateTopBar(payload.summary);
      renderReport(payload);
    } catch (error) {
      console.error(error);
    }
  }

  async function setupTablePage() {
    if (!pathname.endsWith('/audit-table.html')) return;
    try {
      const response = await fetch(currentScanId ? `/api/parts?scanId=${encodeURIComponent(currentScanId)}` : '/api/parts');
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Failed to load parts');
      setActiveScanId(payload.scanId);
      hydrateTopBar(payload.summary);
      renderTable(payload.parts, payload.summary);
    } catch (error) {
      console.error(error);
    }
  }

  async function setupParametricSearch() {
    if (!pathname.endsWith('/parametric-search.html')) return;
    const activeCategory = () => document.querySelector('.category-grid .chip.active')?.textContent?.trim() || 'LDO';
    const getValue = (labelPrefix) => {
      const labels = Array.from(document.querySelectorAll('.field label'));
      const label = labels.find((item) => item.textContent.toLowerCase().includes(labelPrefix.toLowerCase()));
      return label?.nextElementSibling?.value || '';
    };
    const packageInput = Array.from(document.querySelectorAll('.field.single input')).find((input) => input.placeholder?.toLowerCase().includes('sot'));

    document.querySelectorAll('.category-grid .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.category-grid .chip').forEach((item) => item.classList.remove('active'));
        chip.classList.add('active');
        loadResults();
      });
    });

    document.querySelectorAll('.field input').forEach((input) => input.addEventListener('change', loadResults));
    if (packageInput) packageInput.addEventListener('input', debounce(loadResults, 300));
    await loadResults();

    async function loadResults() {
      try {
        const params = new URLSearchParams({
          category: activeCategory(),
          vmax: getValue('Supply rail'),
          vout: getValue('Vout'),
          iout: getValue('Iout'),
          noise: getValue('Noise'),
          tmin: getValue('Min temp'),
          tmax: getValue('Max temp'),
          package: packageInput?.value || '',
        });
        const response = await fetch(`/api/parametric-search?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Search failed');
        renderParametricResults(payload.results, payload.count);
      } catch (error) {
        console.error(error);
      }
    }
  }

  function setupWatchForm(scanId) {
    document.querySelectorAll('.watch-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const form = button.closest('.monitor-form');
        const input = form?.querySelector('input');
        if (!input) return;
        try {
          const response = await fetch('/api/watch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: input.value, scanId }),
          });
          const payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Failed to save watch');
          input.value = '';
          button.textContent = 'Saved';
          setTimeout(() => (button.textContent = 'Watch'), 1600);
        } catch (error) {
          alert(error.message);
        }
      });
    });

    document.querySelectorAll('[data-close-monitor]').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.closest('.monitor-card')?.remove();
      });
    });
  }

  function hydrateTopBar(summary) {
    const title = document.querySelector('.app-title');
    if (title && summary) title.textContent = `${summary.totalLines} parts`;
    const counts = document.querySelectorAll('.badge-counts .count');
    if (counts.length >= 3 && summary) {
      counts[0].innerHTML = `◉ ${summary.critical}`;
      counts[1].innerHTML = `△ ${summary.warning}`;
      counts[2].innerHTML = `◌ ${summary.healthy}`;
    }
  }

  function renderReport(payload) {
    const gradeLetter = document.querySelector('.grade-letter');
    const verdict = document.querySelector('.hero-grade .muted');
    const heroStats = document.querySelector('.hero-grade .rowline.tiny');
    const sectionBadgeCounts = document.querySelectorAll('.section-head .badge-counts .count');
    const alertList = document.querySelector('.alert-list');
    const bottomStatus = document.querySelector('.section-card .bottom-status');

    if (gradeLetter) gradeLetter.textContent = payload.grade;
    if (verdict) verdict.textContent = payload.verdict;
    if (heroStats) {
      heroStats.innerHTML = `<span>${payload.summary.totalLines} parts analyzed</span><span>•</span><span class="count red">${payload.summary.critical} critical</span><span>•</span><span class="count amber">${payload.summary.warning} warnings</span>`;
    }
    if (sectionBadgeCounts.length >= 2) {
      sectionBadgeCounts[0].textContent = `${payload.summary.critical} critical`;
      sectionBadgeCounts[1].textContent = `${payload.summary.warning} warning`;
    }
    if (alertList) {
      alertList.innerHTML = payload.alerts.map((alert) => `
        <div class="alert-row ${alert.severity}">
          <div class="icon">${alert.severity === 'critical' ? '⊘' : '△'}</div>
          <div class="status-text">${escapeHtml(alert.part)} &nbsp;${escapeHtml(alert.title)}</div>
          <div class="desc">${escapeHtml(alert.description)}</div>
        </div>
      `).join('');
    }
    if (bottomStatus) {
      bottomStatus.innerHTML = `<span>$ BOM Total: <strong>$${formatMoney(payload.summary.bomTotal)}</strong></span><span>◫ ${payload.summary.totalLines} lines • ${payload.summary.totalQty} pcs</span><span class="red">◉ ${payload.summary.critical} out of stock / critical</span>`;
    }
  }

  function renderTable(parts, summary) {
    const tbody = document.querySelector('tbody');
    const bottomStatus = document.querySelector('.main .bottom-status');
    if (tbody) {
      tbody.innerHTML = parts.map((part) => `
        <tr class="${part.risk === 'critical' ? 'row-border-red' : part.risk === 'warning' ? 'row-border-amber' : ''}">
          <td class="${riskClass(part.risk)}">${part.risk === 'critical' ? '⊘' : part.risk === 'warning' ? '△' : '◌'}</td>
          <td class="mpn">${escapeHtml(part.mpn)}</td>
          <td>${escapeHtml(part.manufacturer || '')}</td>
          <td>${escapeHtml(part.description || '')}</td>
          <td>${part.qty}</td>
          <td>${escapeHtml(part.category || '')}</td>
          <td>${escapeHtml(part.package || '')}</td>
          <td><span class="status ${lifecycleClass(part.lifecycle)}">${escapeHtml(part.lifecycle || '')}</span></td>
          <td class="${part.risk === 'healthy' ? 'y-green' : 'y-red'}">${escapeHtml(part.yteol || '')}</td>
          <td class="${stockClass(part.stock)}">${formatInteger(part.stock)}</td>
          <td>${part.unitPrice == null ? '—' : `$${formatMoney(part.unitPrice)}`}</td>
          <td>${part.extPrice == null ? '—' : `$${formatMoney(part.extPrice)}`}</td>
          <td class="${part.trend === 'down' ? 'stock-red' : part.trend === 'up' ? 'stock-green' : ''}">${part.trend === 'down' ? '↘' : part.trend === 'up' ? '↗' : '—'}</td>
          <td>${(part.compliance || []).map((item) => `<span class="comp-badge">${escapeHtml(item)}</span>`).join('')}</td>
        </tr>
      `).join('');
    }
    if (bottomStatus) {
      bottomStatus.innerHTML = `<span>$ BOM Total: <strong>$${formatMoney(summary.bomTotal)}</strong></span><span>◫ ${summary.totalLines} lines • ${summary.totalQty} pcs</span><span class="red">◉ ${summary.critical} critical</span>`;
    }
  }

  function renderParametricResults(results, count) {
    const tableBody = document.querySelector('.data-list tbody');
    const footerCount = document.querySelector('.param-footer span');
    if (footerCount) footerCount.textContent = `⌕ ${count} matches`;
    if (!tableBody) return;
    tableBody.innerHTML = results.map((part) => `
      <tr>
        <td class="exp"><div class="add-box">＋</div></td>
        <td><div class="mpn">${escapeHtml(part.mpn)}</div><div class="muted tiny">${escapeHtml(part.manufacturer)}<br>${escapeHtml(part.category)}</div></td>
        <td>${escapeHtml(part.package)}</td><td>${part.vinMin} V</td><td>${part.vinMax} V</td><td>${part.vout} V</td><td>${part.ioutMax} A</td><td>${Math.round(part.noise * 1000)} μVrms</td><td>${part.tempMin} to ${part.tempMax}</td><td class="${stockClass(part.stock)}">${formatInteger(part.stock)}</td><td>$${formatMoney(part.price1k)}</td><td><span class="status ${lifecycleClass(part.lifecycle)}">${escapeHtml(part.lifecycle)}</span></td><td>${(part.compliance || []).map((item) => `<span class="comp-badge">${escapeHtml(item)}</span>`).join('')}</td><td class="distributors">${(part.distributors || []).join(', ')}</td>
      </tr>
    `).join('');
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const commaIndex = result.indexOf(',');
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function formatMoney(value) {
    return Number(value || 0).toFixed(Number(value) < 0.01 && Number(value) > 0 ? 4 : 2);
  }

  function formatInteger(value) {
    return new Intl.NumberFormat().format(Number(value || 0));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function riskClass(risk) {
    return risk === 'critical' ? 'stock-red' : risk === 'warning' ? 'stock-amber' : 'stock-green';
  }

  function stockClass(stock) {
    if (Number(stock) <= 0) return 'stock-red';
    if (Number(stock) < 100) return 'stock-amber';
    return 'stock-green';
  }

  function lifecycleClass(lifecycle) {
    const value = String(lifecycle || '').toLowerCase();
    if (value === 'eol') return 'eol';
    if (value === 'nrnd') return 'nrnd';
    return 'active';
  }
});
