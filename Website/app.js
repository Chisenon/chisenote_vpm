(function() {
  'use strict';

  const VCC_PROTOCOL = 'vcc://vpm/addRepo?url=';

  let allPackages = [];

  function parseVersionKey(key) {
    const core = key.split('+')[0].split('-')[0];
    const nums = core.split('.').map(n => parseInt(n, 10) || 0);
    const prePart = key.split('+')[0].includes('-')
      ? key.split('+')[0].split('-').slice(1).join('.')
      : '';
    const preIds = prePart
      ? prePart.split('.').map(n => {
          const num = parseInt(n, 10);
          return isNaN(num) ? n : num;
        })
      : null;
    return { nums, preIds };
  }

  function compareVersionKeys(a, b) {
    const pa = parseVersionKey(a);
    const pb = parseVersionKey(b);
    const len = Math.max(pa.nums.length, pb.nums.length);
    for (let i = 0; i < len; i++) {
      const d = (pb.nums[i] || 0) - (pa.nums[i] || 0);
      if (d) return d;
    }
    if (!pa.preIds && !pb.preIds) return 0;
    if (!pa.preIds) return -1;
    if (!pb.preIds) return 1;
    const plen = Math.max(pa.preIds.length, pb.preIds.length);
    for (let i = 0; i < plen; i++) {
      const xa = pa.preIds[i];
      const xb = pb.preIds[i];
      if (xa === undefined) return 1;
      if (xb === undefined) return -1;
      if (xa === xb) continue;
      if (typeof xa === 'number' && typeof xb === 'number') return xb - xa;
      if (typeof xa === 'number') return 1;
      if (typeof xb === 'number') return -1;
      return xa < xb ? 1 : -1;
    }
    return 0;
  }

  function getLatestVersion(versions) {
    return Object.keys(versions).sort(compareVersionKeys)[0];
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function safeUrl(url) {
    if (typeof url !== 'string') return '#';
    const trimmed = url.trim();
    if (!trimmed || trimmed === '#') return '#';
    try {
      const parsed = new URL(trimmed, window.location.href);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.href;
      }
    } catch (e) {
      return '#';
    }
    return '#';
  }

  async function fetchListingData() {
    const resp = await fetch('index.json');
    if (!resp.ok) throw new Error('Failed to load index.json');
    return resp.json();
  }

  function renderPackages(packages) {
    allPackages = [];

    Object.entries(packages).forEach(([id, pkg]) => {
      const version = pkg.versions[getLatestVersion(pkg.versions)];
      if (!version) return;
      allPackages.push({ id, version });
    });

    renderFilteredPackages();
  }

  function createPackageEntry(pkg) {
    const v = pkg.version;
    const el = document.createElement('div');
    el.className = 'package-entry';
    el.dataset.packageName = v.displayName || pkg.id;
    el.dataset.packageId = pkg.id;

    el.innerHTML =
      '<div class="pkg-info">' +
        '<div class="pkg-header">' +
          '<span class="pkg-name">' + escapeHtml(v.displayName || pkg.id) + '</span>' +
        '</div>' +
        '<div class="pkg-desc">' + escapeHtml(v.description || '') + '</div>' +
        '<div class="pkg-id">' + escapeHtml(pkg.id) + '</div>' +
      '</div>' +
      '<div class="pkg-actions">' +
        '<button class="rowAddToVccButton ds-blue" data-package-id="' + escapeHtml(pkg.id) + '" title="Add to VCC">Add to VCC</button>' +
        '<button class="rowPackageInfoButton" data-package-id="' + escapeHtml(pkg.id) + '" title="Info">Info</button>' +
        '<button class="rowDownloadButton ds-slate" data-url="' + escapeHtml(v.url || '#') + '" title="Download ZIP">Download ZIP</button>' +
        '<span class="pkg-version">v' + escapeHtml(v.version) + '</span>' +
      '</div>';

    return el;
  }

  function renderFilteredPackages() {
    const list = document.getElementById('packageList');
    const searchVal = (document.getElementById('searchInput').value || '').toLowerCase();

    const filtered = allPackages.filter(pkg => {
      if (searchVal) {
        const name = (pkg.version.displayName || '').toLowerCase();
        const desc = (pkg.version.description || '').toLowerCase();
        const id = pkg.id.toLowerCase();
        if (!name.includes(searchVal) && !desc.includes(searchVal) && !id.includes(searchVal)) return false;
      }
      return true;
    });

    list.innerHTML = '';
    filtered.forEach(pkg => list.appendChild(createPackageEntry(pkg)));
  }

  function setupSearch() {
    const input = document.getElementById('searchInput');
    let debounceTimer;
    input.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(renderFilteredPackages, 150);
    });
  }

  function setupActions() {
    document.getElementById('vccAddRepoButton').addEventListener('click', function() {
      const url = document.getElementById('vccUrlField').value;
      window.location.assign(VCC_PROTOCOL + encodeURIComponent(url));
    });

    document.getElementById('vccUrlFieldCopy').addEventListener('click', function() {
      const field = document.getElementById('vccUrlField');
      field.select();
      navigator.clipboard.writeText(field.value).then(() => {
        this.textContent = '✓';
        setTimeout(() => { this.textContent = 'C'; }, 1500);
      }).catch(() => {
        this.textContent = '×';
        setTimeout(() => { this.textContent = 'C'; }, 1500);
      });
    });

    document.getElementById('packageList').addEventListener('click', function(e) {
      const btn = e.target.closest('.rowAddToVccButton');
      if (btn) {
        const url = document.getElementById('vccUrlField').value;
        window.location.assign(VCC_PROTOCOL + encodeURIComponent(url));
        return;
      }

      const dlBtn = e.target.closest('.rowDownloadButton');
      if (dlBtn) {
        const url = safeUrl(dlBtn.dataset.url);
        if (url !== '#') {
          const w = window.open(url, '_blank');
          if (w) w.opener = null;
        }
        return;
      }

      const infoBtn = e.target.closest('.rowPackageInfoButton');
      if (infoBtn) {
        const pkgId = infoBtn.dataset.packageId;
        const pkg = allPackages.find(p => p.id === pkgId);
        if (pkg) openDialog(pkg);
        return;
      }
    });
  }

  function openDialog(pkg) {
    const v = pkg.version;

    document.getElementById('dialogName').textContent = v.displayName || pkg.id;
    document.getElementById('dialogId').textContent = pkg.id;
    document.getElementById('dialogVersion').textContent = 'v' + v.version;
    document.getElementById('dialogDescription').textContent = v.description || 'No description.';

    const authorLink = document.getElementById('dialogAuthor');
    if (v.author) {
      authorLink.textContent = v.author.name || v.author;
      authorLink.href = safeUrl(v.author.url);
    } else {
      authorLink.textContent = 'Unknown';
      authorLink.href = '#';
    }

    const depList = document.getElementById('dialogDependencies');
    depList.innerHTML = '';
    const deps = v.vpmDependencies || v.dependencies || {};
    const depEntries = Object.entries(deps);
    if (depEntries.length === 0) {
      depList.innerHTML = '<li class="no-deps">No dependencies.</li>';
    } else {
      depEntries.forEach(([name, ver]) => {
        const li = document.createElement('li');
        li.innerHTML = '<span class="mono">' + escapeHtml(name) + '</span> <span class="dep-ver">@ ' + escapeHtml(ver) + '</span>';
        depList.appendChild(li);
      });
    }

    document.getElementById('dialogUnity').textContent = v.unity || 'N/A';

    const dlLink = document.getElementById('dialogDownloadLink');
    if (v.url) {
      dlLink.href = safeUrl(v.url);
      dlLink.classList.remove('disabled');
    } else {
      dlLink.href = '#';
      dlLink.classList.add('disabled');
    }

    document.getElementById('infoDialog').showModal();
  }

  function setupDialog() {
    document.getElementById('dialogClose').addEventListener('click', function() {
      document.getElementById('infoDialog').close();
    });
    document.getElementById('infoDialog').addEventListener('click', function(e) {
      if (e.target === this) this.close();
    });
  }

  function buildClockMarks() {
    const g = document.getElementById('clockMarks');
    if (!g) return;
    const svgns = 'http://www.w3.org/2000/svg';
    const cx = 50, cy = 50, R = 38;
    const labels = { 0: '12', 3: '3', 6: '6', 9: '9' };
    for (let k = 0; k < 12; k++) {
      const ang = (k * 30 - 90) * Math.PI / 180;
      const dx = R * Math.cos(ang);
      const dy = R * Math.sin(ang);
      const m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
      const f = R / m;
      const px = (cx + dx * f).toFixed(2);
      const py = (cy + dy * f).toFixed(2);
      if (labels[k]) {
        const t = document.createElementNS(svgns, 'text');
        t.setAttribute('x', px);
        t.setAttribute('y', py);
        t.setAttribute('class', 'clock-num');
        t.textContent = labels[k];
        g.appendChild(t);
      } else {
        const c = document.createElementNS(svgns, 'circle');
        c.setAttribute('cx', px);
        c.setAttribute('cy', py);
        c.setAttribute('r', '2');
        c.setAttribute('class', 'clock-dot');
        g.appendChild(c);
      }
    }
  }

  function updateClock() {
    function pad(n) { return String(n).padStart(2, '0'); }
    const hourHand = document.getElementById('clockHour');
    const minHand = document.getElementById('clockMinute');
    const secHand = document.getElementById('clockSecond');
    function update() {
      const now = new Date();
      const hh = pad(now.getHours());
      const mm = pad(now.getMinutes());
      document.getElementById('barTime').textContent = hh + ':' + mm;

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = [
        { short: 'Jan', full: 'January' },
        { short: 'Feb', full: 'February' },
        { short: 'Mar', full: 'March' },
        { short: 'Apr', full: 'April' },
        { short: 'May', full: 'May' },
        { short: 'Jun', full: 'June' },
        { short: 'Jul', full: 'July' },
        { short: 'Aug', full: 'August' },
        { short: 'Sep', full: 'September' },
        { short: 'Oct', full: 'October' },
        { short: 'Nov', full: 'November' },
        { short: 'Dec', full: 'December' }
      ];
      const day = dayNames[now.getDay()];
      const month = months[now.getMonth()];
      const date = now.getDate();
      document.getElementById('barDate').textContent = day + ' ' + month.short + ' ' + date;

      const sec = now.getSeconds();
      const min = now.getMinutes();
      const hr = now.getHours();
      if (hourHand) hourHand.setAttribute('transform', 'rotate(' + ((hr % 12) * 30 + min * 0.5) + ' 50 50)');
      if (minHand) minHand.setAttribute('transform', 'rotate(' + (min * 6 + sec * 0.1) + ' 50 50)');
      if (secHand) secHand.setAttribute('transform', 'rotate(' + (sec * 6) + ' 50 50)');
    }
    update();
    setInterval(update, 1000);
  }

  async function init() {
    setupSearch();
    setupActions();
    setupDialog();
    buildClockMarks();
    updateClock();

    try {
      const data = await fetchListingData();
      const url = data.url || window.location.origin + '/index.json';
      document.getElementById('vccUrlField').value = url;
      renderPackages(data.packages || {});
    } catch (err) {
      document.getElementById('packageList').innerHTML = '<div class="package-entry" style="justify-content:center;color:#f88">Failed to load listing. Check console for details.</div>';
      console.error('Init error:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
