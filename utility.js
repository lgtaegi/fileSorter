/*
 * fileSorter
 * Created: 2026-05-04
 * Created by lgtaegi
 */
(() => {
  const { api, formatNumber, formatPath, clearNode, appendLog, basename } = window.FileSorter;

  const utilityPath = document.getElementById('utilityPath');
  const loadUtilityBtn = document.getElementById('loadUtilityBtn');
  const browseUtilityBtn = document.getElementById('browseUtilityBtn');
  const flattenBtn = document.getElementById('flattenBtn');
  const diagnoseUtilityBtn = document.getElementById('diagnoseUtilityBtn');
  const clearUtilityLogBtn = document.getElementById('clearUtilityLogBtn');
  const utilityLog = document.getElementById('utilityLog');
  const utilityDiagnostics = document.getElementById('utilityDiagnostics');
  const pickerModal = document.getElementById('pickerModal');
  const pickerPath = document.getElementById('pickerPath');
  const pickerList = document.getElementById('pickerList');
  const pickerRoots = document.getElementById('pickerRoots');
  const pickerStats = document.getElementById('pickerStats');
  const pickerParentBtn = document.getElementById('pickerParentBtn');
  const pickerUseBtn = document.getElementById('pickerUseBtn');
  const closePickerBtn = document.getElementById('closePickerBtn');
  const summary = {
    items: document.getElementById('utilityItems'),
    files: document.getElementById('utilityFiles'),
    folders: document.getElementById('utilityFolders'),
    sortable: document.getElementById('utilitySortable'),
  };

  let currentPickerPath = '';

  function setSummary(stats) {
    summary.items.textContent = formatNumber(stats.items);
    summary.files.textContent = formatNumber(stats.files);
    summary.folders.textContent = formatNumber(stats.folders);
    summary.sortable.textContent = formatNumber(stats.sortableFiles ?? stats.files);
  }

  async function loadStats(pathValue) {
    const path = pathValue.trim();
    if (!path) {
      setSummary({ items: 0, files: 0, folders: 0, sortableFiles: 0 });
      return null;
    }

    const payload = await api.getStats(path);
    setSummary(payload.stats);
    utilityDiagnostics.innerHTML = '';
    return payload;
  }

  function updateButtons() {
    flattenBtn.disabled = !utilityPath.value.trim();
  }

  async function refreshPicker(pathValue) {
    const payload = await api.getDirectories(pathValue);
    currentPickerPath = payload.path;
    pickerPath.textContent = formatPath(payload.path);

    clearNode(pickerRoots);
    payload.roots.forEach(root => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'root-chip';
      button.textContent = root.name;
      button.addEventListener('click', () => refreshPicker(root.path));
      pickerRoots.appendChild(button);
    });

    clearNode(pickerStats);
    [
      ['items', payload.stats.items],
      ['files', payload.stats.files],
      ['folders', payload.stats.folders],
      ['sortable', payload.stats.sortableFiles ?? payload.stats.files],
    ].forEach(([label, value]) => {
      const card = document.createElement('div');
      card.className = 'summary-card compact-card';
      card.innerHTML = `<span class="summary-label">${label}</span><strong>${formatNumber(value)}</strong>`;
      pickerStats.appendChild(card);
    });

    clearNode(pickerList);
    pickerParentBtn.disabled = !payload.parent;

    if (payload.directories.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No subfolders in this directory.';
      pickerList.appendChild(empty);
      return;
    }

    payload.directories.forEach(dir => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'folder-row';
      row.innerHTML = `<span>${basename(dir.name)}</span><small>${dir.path}</small>`;
      row.addEventListener('click', () => refreshPicker(dir.path));
      pickerList.appendChild(row);
    });
  }

  async function openPicker(initialPath) {
    currentPickerPath = initialPath || utilityPath.value.trim() || '/';
    pickerModal.classList.remove('hidden');
    pickerModal.setAttribute('aria-hidden', 'false');
    await refreshPicker(currentPickerPath);
  }

  function closePicker() {
    pickerModal.classList.add('hidden');
    pickerModal.setAttribute('aria-hidden', 'true');
  }

  async function runFlatten() {
    const source = utilityPath.value.trim();
    if (!source) return;

    flattenBtn.disabled = true;
    appendLog(utilityLog, [`Running utility for ${source}...`]);

    try {
      const result = await api.flatten({
        source,
        delete_empty_folders: document.getElementById('deleteEmptyFolders').checked,
        dry_run: document.getElementById('dryRunUtility').checked,
      });

      appendLog(utilityLog, [
        result.dry_run ? 'Move files out of folders preview.' : 'Move files out of folders complete.',
        `Files before run: ${formatNumber(result.before.files)}`,
        `Files after run: ${formatNumber(result.after.files)}`,
        `File count match: ${result.before.files === result.after.files ? 'Yes' : 'No'}`,
        `Files found: ${formatNumber(result.foundFiles)}`,
        `Already in source: ${formatNumber(result.alreadyInSource)}`,
        `Files that would move to source: ${formatNumber(result.wouldMoveToSource)}`,
        `Files in source after: ${formatNumber(result.filesInSourceAfter)}`,
        `Empty folders that would be deleted: ${formatNumber(result.emptyFoldersDeleted)}`,
      ]);
    } catch (error) {
      appendLog(utilityLog, [`Error: ${error.message}`]);
    } finally {
      updateButtons();
    }
  }

  async function diagnoseUtility() {
    const path = utilityPath.value.trim();
    if (!path) return;
    diagnoseUtilityBtn.disabled = true;
    try {
      const result = await api.diagnose({ path });
      const lines = [
        `Filesystem entries: ${formatNumber(result.entries)}`,
        `Sortable files: ${formatNumber(result.sortableFiles)}`,
        `Folders: ${formatNumber(result.folders)}`,
        `Packages counted as files: ${formatNumber(result.packages)}`,
        `Hidden entries: ${formatNumber(result.hidden)}`,
        `Symlinks / aliases: ${formatNumber(result.symlinks)}`,
      ];
      if (result.special && result.special.length) {
        lines.push('Special entries:');
        result.special.slice(0, 12).forEach(item => lines.push(`- ${item.type}: ${item.path}`));
      }
      appendLog(utilityDiagnostics, lines);
    } catch (error) {
      appendLog(utilityDiagnostics, [`Error: ${error.message}`]);
    } finally {
      diagnoseUtilityBtn.disabled = false;
    }
  }

  utilityPath.addEventListener('input', updateButtons);
  utilityPath.addEventListener('change', async () => {
    try {
      await loadStats(utilityPath.value);
    } catch (error) {
      appendLog(utilityDiagnostics, [`Error: ${error.message}`]);
    } finally {
      updateButtons();
    }
  });

  loadUtilityBtn.addEventListener('click', async () => {
    try {
      await loadStats(utilityPath.value);
    } catch (error) {
      appendLog(utilityDiagnostics, [`Error: ${error.message}`]);
    } finally {
      updateButtons();
    }
  });

  browseUtilityBtn.addEventListener('click', () => openPicker(utilityPath.value.trim()));
  pickerUseBtn.addEventListener('click', async () => {
    utilityPath.value = currentPickerPath;
    closePicker();
    await loadStats(currentPickerPath);
    updateButtons();
  });
  pickerParentBtn.addEventListener('click', async () => {
    const payload = await api.getDirectories(currentPickerPath);
    if (payload.parent) {
      await refreshPicker(payload.parent);
    }
  });
  closePickerBtn.addEventListener('click', closePicker);
  pickerModal.addEventListener('click', event => {
    if (event.target === pickerModal) closePicker();
  });

  flattenBtn.addEventListener('click', runFlatten);
  diagnoseUtilityBtn.addEventListener('click', diagnoseUtility);
  clearUtilityLogBtn.addEventListener('click', () => clearNode(utilityLog));

  loadStats(utilityPath.value).catch(() => null).finally(() => updateButtons());
})();
