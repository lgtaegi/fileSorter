/*
 * fileSorter
 * Created: 2026-05-04
 * Created by lgtaegi
 */
(function () {
  const api = {
    async request(path, options = {}) {
      const response = await fetch(path, {
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        ...options,
      });

      const raw = await response.text();
      let payload = null;
      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = { raw };
        }
      }

      if (!response.ok) {
        throw new Error(payload?.error || response.statusText || 'Request failed');
      }

      return payload;
    },
    getDirectories(path) {
      const query = new URLSearchParams();
      if (path) query.set('path', path);
      return this.request(`/api/directories?${query.toString()}`);
    },
    getStats(path) {
      const query = new URLSearchParams();
      if (path) query.set('path', path);
      return this.request(`/api/stats?${query.toString()}`);
    },
    getUndoLogs() {
      return this.request('/api/undo-logs');
    },
    undo(payload) {
      return this.request('/api/undo', { method: 'POST', body: JSON.stringify(payload || {}) });
    },
    diagnose(payload) {
      return this.request('/api/diagnose', { method: 'POST', body: JSON.stringify(payload) });
    },
    sort(payload) {
      return this.request('/api/sort', { method: 'POST', body: JSON.stringify(payload) });
    },
    flatten(payload) {
      return this.request('/api/flatten', { method: 'POST', body: JSON.stringify(payload) });
    },
    compare(payload) {
      return this.request('/api/compare', { method: 'POST', body: JSON.stringify(payload) });
    },
    renameFiles(payload) {
      return this.request('/api/rename-files', { method: 'POST', body: JSON.stringify(payload) });
    },
    findDuplicates(payload) {
      return this.request('/api/find-duplicates', { method: 'POST', body: JSON.stringify(payload) });
    },
    emptyFolders(payload) {
      return this.request('/api/empty-folders', { method: 'POST', body: JSON.stringify(payload) });
    },
  };

  function formatNumber(value) {
    return new Intl.NumberFormat('en-US').format(Number(value || 0));
  }

  function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = Number(bytes || 0);
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit += 1;
    }
    return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function basename(value) {
    if (!value) return '';
    const normalized = String(value).replace(/\\/g, '/').replace(/\/+$/, '');
    const parts = normalized.split('/');
    return parts[parts.length - 1] || normalized;
  }

  function createNote(lines, className = 'log-item') {
    const wrapper = document.createElement('article');
    wrapper.className = className;
    lines.forEach(line => {
      const p = document.createElement('p');
      p.textContent = line;
      wrapper.appendChild(p);
    });
    return wrapper;
  }

  function renderLogList(container, items, renderer) {
    clearNode(container);
    if (!items || items.length === 0) {
      container.appendChild(createNote(['Nothing to show yet.'], 'empty-note'));
      return;
    }
    items.forEach(item => container.appendChild(renderer(item)));
  }

  window.FileSorter = {
    api,
    formatNumber,
    formatBytes,
    clearNode,
    basename,
    createNote,
    renderLogList,
  };
})();
