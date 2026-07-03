(function() {
  'use strict';

  const VCC_PROTOCOL = 'vcc://vpm/addRepo?url=';

  let listingData = null;
  let allPackages = [];

  function getLatestVersion(versions) {
    return Object.keys(versions).sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
      }
      return 0;
    })[0];
  }

  function determinePackageTypes(vpmDeps) {
    const types = [];
    const deps = vpmDeps ? Object.keys(vpmDeps) : [];
    const hasAvatar = deps.some(d => d.includes('com.vrchat.avatars'));
    const hasWorld = deps.some(d => d.includes('com.vrchat.worlds'));
    if (hasAvatar) types.push('avatar');
    if (hasWorld) types.push('world');
    if (!hasAvatar && !hasWorld) { types.push('avatar', 'world'); }
    return types;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function fetchListingData() {
    const resp = await fetch('index.json');
    if (!resp.ok) throw new Error('Failed to load index.json');
    return resp.json();
  }

  function renderListingInfo(data) {
    const name = data.name || 'VPM Listing';
    document.getElementById('listingName').textContent = name + "'s VPM Packages";
    document.title = name + ' - VPM Packages';

    const desc = document.getElementById('listingDescription');
    if (data.description) {
      desc.textContent = data.description;
      desc.classList.remove('hidden');
    }

    const authorLink = document.getElementById('authorLink');
    if (data.author) {
      const authorName = typeof data.author === 'string' ? data.author : data.author.name || data.author;
      const authorUrl = data.author.url || 'https://github.com/' + authorName;
      authorLink.textContent = authorName;
      authorLink.href = authorUrl;
    }

    const vccUrl = data.url || window.location.origin + '/index.json';
    document.getElementById('vccUrlField').value = vccUrl;
  }

  function renderPackages(packages) {
    const grid = document.getElementById('packageGrid');
    const emptyState = document.getElementById('emptyState');

    allPackages = [];

    Object.entries(packages).forEach(([id, pkg]) => {
      const latestVer = getLatestVersion(pkg.versions);
      const version = pkg.versions[latestVer];
      if (!version) return;

      const types = determinePackageTypes(version.vpmDependencies);

      allPackages.push({ id, version, types, latestVer });
    });

    renderFilteredPackages();
  }

  function renderFilteredPackages() {
    const grid = document.getElementById('packageGrid');
    const emptyState = document.getElementById('emptyState');
    const searchVal = (document.getElementById('searchInput').value || '').toLowerCase();
    const activeFilter = document.querySelector('.filter-tab.active')?.dataset?.filter || 'all';

    const filtered = allPackages.filter(pkg => {
      if (activeFilter !== 'all' && !pkg.types.includes(activeFilter)) return false;
      if (searchVal) {
        const name = (pkg.version.displayName || '').toLowerCase();
        const desc = (pkg.version.description || '').toLowerCase();
        const id = pkg.id.toLowerCase();
        if (!name.includes(searchVal) && !desc.includes(searchVal) && !id.includes(searchVal)) return false;
      }
      return true;
    });

    grid.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    filtered.forEach(pkg => {
      const card = createPackageCard(pkg);
      grid.appendChild(card);
    });
  }

  function createPackageCard(pkg) {
    const v = pkg.version;
    const typeBadges = (pkg.types || []).map(t =>
      '<span class="type-badge type-' + t + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</span>'
    ).join('');

    const card = document.createElement('div');
    card.className = 'package-card';
    card.dataset.packageId = pkg.id;

    card.innerHTML =
      '<div class="card-body">' +
        '<h3 class="card-title">' + escapeHtml(v.displayName || pkg.id) + '</h3>' +
        '<p class="card-desc">' + escapeHtml(v.description || '') + '</p>' +
        '<div class="card-meta">' +
          '<span class="version-badge">v' + escapeHtml(v.version) + '</span>' +
          typeBadges +
        '</div>' +
        '<div class="card-footer mono">' + escapeHtml(pkg.id) + '</div>' +
      '</div>' +
      '<div class="card-actions">' +
        '<button class="btn btn-primary btn-sm btn-add-vcc" data-package-id="' + escapeHtml(pkg.id) + '">Add to VCC</button>' +
        '<button class="btn btn-outline btn-sm btn-download" data-url="' + escapeHtml(v.url || '#') + '" title="Download .zip">' +
          '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M10.0001 2.00195C10.2456 2.00195 10.4497 2.17896 10.492 2.41222L10.5 2.5021L10.496 14.296L14.1414 10.6476C14.3148 10.4739 14.5842 10.4544 14.7792 10.5892L14.8485 10.647C15.0222 10.8204 15.0418 11.0898 14.907 11.2848L14.8492 11.3541L10.3574 15.8541C10.285 15.9267 10.1957 15.9724 10.1021 15.9911L9.99608 16.0008C9.83511 16.0008 9.69192 15.9247 9.60051 15.8065L5.14386 11.3547C4.94846 11.1595 4.94823 10.8429 5.14336 10.6475C5.3168 10.4739 5.58621 10.4544 5.78117 10.5892L5.85046 10.647L9.496 14.288L9.5 2.50181C9.50008 2.22567 9.724 2.00195 10.0001 2.00195Z"/></svg>' +
        '</button>' +
        '<button class="btn btn-ghost btn-sm btn-info" data-package-id="' + escapeHtml(pkg.id) + '" title="Package Info">' +
          '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M10.4921 8.91012C10.4497 8.67687 10.2456 8.49999 10.0001 8.49999C9.72397 8.49999 9.50011 8.72385 9.50011 8.99999V13.5021L9.50817 13.592C9.55051 13.8253 9.75465 14.0021 10.0001 14.0021C10.2763 14.0021 10.5001 13.7783 10.5001 13.5021V8.99999L10.4921 8.91012ZM10.7988 6.74999C10.7988 6.33578 10.463 5.99999 10.0488 5.99999C9.63461 5.99999 9.29883 6.33578 9.29883 6.74999C9.29883 7.16421 9.63461 7.49999 10.0488 7.49999C10.463 7.49999 10.7988 7.16421 10.7988 6.74999ZM18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10ZM3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10Z"/></svg>' +
        '</button>' +
      '</div>';

    return card;
  }

  function setupSearch() {
    const input = document.getElementById('searchInput');
    let debounceTimer;
    input.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(renderFilteredPackages, 150);
    });
  }

  function setupFilters() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        renderFilteredPackages();
      });
    });
  }

  function setupVccButtons() {
    const vccAddBtn = document.getElementById('vccAddBtn');
    vccAddBtn.addEventListener('click', function() {
      const url = document.getElementById('vccUrlField').value;
      window.location.assign(VCC_PROTOCOL + encodeURIComponent(url));
    });

    const vccCopyBtn = document.getElementById('vccCopyBtn');
    vccCopyBtn.addEventListener('click', function() {
      const urlField = document.getElementById('vccUrlField');
      urlField.select();
      navigator.clipboard.writeText(urlField.value).then(() => {
        const orig = this.textContent;
        this.textContent = 'Copied!';
        setTimeout(() => { this.textContent = orig; }, 1500);
      });
    });

    document.getElementById('packageGrid').addEventListener('click', function(e) {
      const btn = e.target.closest('.btn-add-vcc');
      if (btn) {
        const url = document.getElementById('vccUrlField').value;
        window.location.assign(VCC_PROTOCOL + encodeURIComponent(url));
        return;
      }

      const dlBtn = e.target.closest('.btn-download');
      if (dlBtn) {
        const url = dlBtn.dataset.url;
        if (url && url !== '#') window.open(url, '_blank');
        return;
      }

      const infoBtn = e.target.closest('.btn-info');
      if (infoBtn) {
        const pkgId = infoBtn.dataset.packageId;
        const pkg = allPackages.find(p => p.id === pkgId);
        if (pkg) openModal(pkg);
        return;
      }

      const card = e.target.closest('.package-card');
      if (card) {
        const pkgId = card.dataset.packageId;
        const pkg = allPackages.find(p => p.id === pkgId);
        if (pkg) openModal(pkg);
      }
    });
  }

  function openModal(pkg) {
    const v = pkg.version;

    document.getElementById('modalName').textContent = v.displayName || pkg.id;
    document.getElementById('modalId').textContent = pkg.id;
    document.getElementById('modalVersion').textContent = 'v' + v.version;
    document.getElementById('modalDescription').textContent = v.description || 'No description.';

    const authorLink = document.getElementById('modalAuthor');
    if (v.author) {
      authorLink.textContent = v.author.name || v.author;
      authorLink.href = v.author.url || '#';
    } else {
      authorLink.textContent = 'Unknown';
      authorLink.href = '#';
    }

    const depList = document.getElementById('modalDependencies');
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

    document.getElementById('modalUnity').textContent = v.unity || 'N/A';

    const dlLink = document.getElementById('modalDownloadLink');
    if (v.url) {
      dlLink.href = v.url;
      dlLink.classList.remove('disabled');
    } else {
      dlLink.href = '#';
      dlLink.classList.add('disabled');
    }

    document.getElementById('modalOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function setupModal() {
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', function(e) {
      if (e.target === this) closeModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
    document.body.style.overflow = '';
  }

  async function init() {
    try {
      listingData = await fetchListingData();
      renderListingInfo(listingData);
      renderPackages(listingData.packages || {});
      setupSearch();
      setupFilters();
      setupVccButtons();
      setupModal();
    } catch (err) {
      document.getElementById('listingName').textContent = 'Failed to load listing';
      console.error('Init error:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
