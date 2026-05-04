/*
 * fileSorter
 * Created: 2026-05-04
 * Created by lgtaegi
 */
(() => {
  const { api, formatNumber, formatBytes, clearNode, basename, createNote, renderLogList } = window.FileSorter;

  const state = {
    currentSource: '',
    utilityOverridden: false,
    comparePreviewSeen: false,
    currentPickerTarget: 'source',
    currentPickerPath: '/',
    undoLogs: [],
  };

  const els = {
    tabs: Array.from(document.querySelectorAll('.primary-tab')),
    panels: Array.from(document.querySelectorAll('.tab-panel')),
    sourcePath: document.getElementById('sourcePath'),
    loadSourceBtn: document.getElementById('loadSourceBtn'),
    browseSourceBtn: document.getElementById('browseSourceBtn'),
    diagnoseSourceBtn: document.getElementById('diagnoseSourceBtn'),
    sourceItems: document.getElementById('sourceItems'),
    sourceFiles: document.getElementById('sourceFiles'),
    sourceFolders: document.getElementById('sourceFolders'),
    sourceSortable: document.getElementById('sourceSortable'),
    currentSourceName: document.getElementById('currentSourceName'),
    undoLogCount: document.getElementById('undoLogCount'),
    sourceDiagnostics: document.getElementById('sourceDiagnostics'),
    destPath: document.getElementById('destPath'),
    browseDestBtn: document.getElementById('browseDestBtn'),
    includeSubfolders: document.getElementById('includeSubfolders'),
    copyInsteadOfMove: document.getElementById('copyInsteadOfMove'),
    sortPreviewOnly: document.getElementById('sortPreviewOnly'),
    sortBtn: document.getElementById('sortBtn'),
    sortUndoBtn: document.getElementById('sortUndoBtn'),
    sortPreviewList: document.getElementById('sortPreviewList'),
    sortSizeRuleEnabled: document.getElementById('sortSizeRuleEnabled'),
    sortSizeComparator: document.getElementById('sortSizeComparator'),
    sortSizeValue: document.getElementById('sortSizeValue'),
    sortSizeUnit: document.getElementById('sortSizeUnit'),
    utilityPath: document.getElementById('utilityPath'),
    loadUtilityBtn: document.getElementById('loadUtilityBtn'),
    browseUtilityBtn: document.getElementById('browseUtilityBtn'),
    undoLatestBtn: document.getElementById('undoLatestBtn'),
    refreshLogsBtn: document.getElementById('refreshLogsBtn'),
    undoLogList: document.getElementById('undoLogList'),
    compareFolderA: document.getElementById('compareFolderA'),
    compareFolderB: document.getElementById('compareFolderB'),
    compareMatchBy: document.getElementById('compareMatchBy'),
    compareDirection: document.getElementById('compareDirection'),
    compareVerifyContents: document.getElementById('compareVerifyContents'),
    compareReplaceDifferent: document.getElementById('compareReplaceDifferent'),
    compareDeleteTargetOnly: document.getElementById('compareDeleteTargetOnly'),
    compareProtectedMode: document.getElementById('compareProtectedMode'),
    comparePreviewOnly: document.getElementById('comparePreviewOnly'),
    runCompareBtn: document.getElementById('runCompareBtn'),
    applyCompareBtn: document.getElementById('applyCompareBtn'),
    compareUndoBtn: document.getElementById('compareUndoBtn'),
    browseCompareABtn: document.getElementById('browseCompareABtn'),
    browseCompareBBtn: document.getElementById('browseCompareBBtn'),
    compareActionPreview: document.getElementById('compareActionPreview'),
    onlyInAList: document.getElementById('onlyInAList'),
    differentList: document.getElementById('differentList'),
    onlyInBList: document.getElementById('onlyInBList'),
    onlyInACount: document.getElementById('onlyInACount'),
    differentCount: document.getElementById('differentCount'),
    onlyInBCount: document.getElementById('onlyInBCount'),
    renameTrimWhitespace: document.getElementById('renameTrimWhitespace'),
    renameReplaceSpaces: document.getElementById('renameReplaceSpaces'),
    renameRemoveSpecial: document.getElementById('renameRemoveSpecial'),
    renameAddDatePrefix: document.getElementById('renameAddDatePrefix'),
    renameSequence: document.getElementById('renameSequence'),
    previewRenameBtn: document.getElementById('previewRenameBtn'),
    applyRenameBtn: document.getElementById('applyRenameBtn'),
    renameUndoBtn: document.getElementById('renameUndoBtn'),
    renamePreviewList: document.getElementById('renamePreviewList'),
    duplicateMode: document.getElementById('duplicateMode'),
    duplicateKeepRule: document.getElementById('duplicateKeepRule'),
    duplicateDeleteMode: document.getElementById('duplicateDeleteMode'),
    findDuplicatesBtn: document.getElementById('findDuplicatesBtn'),
    duplicateUndoBtn: document.getElementById('duplicateUndoBtn'),
    duplicateResults: document.getElementById('duplicateResults'),
    emptyFolderPreviewOnly: document.getElementById('emptyFolderPreviewOnly'),
    runEmptyFolderBtn: document.getElementById('runEmptyFolderBtn'),
    emptyUndoBtn: document.getElementById('emptyUndoBtn'),
    emptyFolderResults: document.getElementById('emptyFolderResults'),
    dryRunUtility: document.getElementById('dryRunUtility'),
    deleteEmptyFolders: document.getElementById('deleteEmptyFolders'),
    flattenBtn: document.getElementById('flattenBtn'),
    flattenUndoBtn: document.getElementById('flattenUndoBtn'),
    utilityLog: document.getElementById('utilityLog'),
    pickerModal: document.getElementById('pickerModal'),
    pickerTitle: document.getElementById('pickerTitle'),
    pickerPath: document.getElementById('pickerPath'),
    pickerList: document.getElementById('pickerList'),
    pickerRoots: document.getElementById('pickerRoots'),
    pickerStats: document.getElementById('pickerStats'),
    pickerParentBtn: document.getElementById('pickerParentBtn'),
    pickerUseBtn: document.getElementById('pickerUseBtn'),
    closePickerBtn: document.getElementById('closePickerBtn'),
  };

  function setActiveTab(name) {
    els.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === name));
    els.panels.forEach(panel => panel.classList.toggle('active', panel.dataset.panel === name));
    location.hash = name;
  }

  function showError(error) {
    alert(error instanceof Error ? error.message : String(error));
  }

  function getSortGroupBy() {
    return Array.from(document.querySelectorAll('input[name="sortGroup"]'))
      .filter(input => input.checked)
      .map(input => input.value);
  }

  function sizeRulePayload() {
    if (!els.sortSizeRuleEnabled.checked) return null;
    return {
      enabled: true,
      comparator: els.sortSizeComparator.value,
      value: Number(els.sortSizeValue.value || 0),
      unit: els.sortSizeUnit.value,
    };
  }

  function updateSourceSummary(stats) {
    els.sourceItems.textContent = formatNumber(stats.items);
    els.sourceFiles.textContent = formatNumber(stats.files);
    els.sourceFolders.textContent = formatNumber(stats.folders);
    els.sourceSortable.textContent = formatNumber(stats.sortableFiles ?? stats.files);
  }

  function updateSourceLabel() {
    els.currentSourceName.textContent = state.currentSource ? basename(state.currentSource) : 'Not selected';
  }

  function updateActionLabels() {
    els.sortBtn.textContent = els.sortPreviewOnly.checked ? 'Preview sorting' : 'Run sorting';
    els.flattenBtn.textContent = els.dryRunUtility.checked ? 'Preview moving files out' : 'Move files out of folders';
    const compareLocked = els.compareProtectedMode.checked && !state.comparePreviewSeen;
    els.applyCompareBtn.disabled = els.comparePreviewOnly.checked || compareLocked;
    els.sortBtn.disabled = !els.sourcePath.value.trim() || getSortGroupBy().length === 0;
    const hasUtilitySource = Boolean(els.utilityPath.value.trim());
    els.previewRenameBtn.disabled = !hasUtilitySource;
    els.applyRenameBtn.disabled = !hasUtilitySource;
    els.findDuplicatesBtn.disabled = !hasUtilitySource;
    els.runEmptyFolderBtn.disabled = !hasUtilitySource;
    els.flattenBtn.disabled = !hasUtilitySource;
    els.sortUndoBtn.disabled = !latestUndoLog(['sort']);
    els.compareUndoBtn.disabled = !latestUndoLog(['compare-sync']);
    els.renameUndoBtn.disabled = !latestUndoLog(['file-name-cleaner']);
    els.duplicateUndoBtn.disabled = !latestUndoLog(['duplicate-cleanup']);
    els.emptyUndoBtn.disabled = !latestUndoLog(['empty-folder-cleaner']);
    els.flattenUndoBtn.disabled = !latestUndoLog(['flatten']);
  }

  function latestUndoLog(kinds) {
    return state.undoLogs.find(log => kinds.includes(log.kind) && !log.undoneAt) || null;
  }

  async function loadSourceStats(pathValue) {
    const path = pathValue.trim();
    if (!path) {
      state.currentSource = '';
      updateSourceSummary({ items: 0, files: 0, folders: 0, sortableFiles: 0 });
      updateSourceLabel();
      updateActionLabels();
      return;
    }
    const payload = await api.getStats(path);
    state.currentSource = path;
    updateSourceSummary(payload.stats);
    updateSourceLabel();
    if (!state.utilityOverridden) {
      els.utilityPath.value = path;
    }
    if (!els.compareFolderA.value.trim()) els.compareFolderA.value = path;
    if (!els.compareFolderB.value.trim()) els.compareFolderB.value = path;
    updateActionLabels();
  }

  async function loadUndoLogs() {
    const payload = await api.getUndoLogs();
    state.undoLogs = payload.logs || [];
    els.undoLogCount.textContent = formatNumber(payload.logs.length);
    renderLogList(els.undoLogList, payload.logs, item => {
      const wrapper = document.createElement('article');
      wrapper.className = `log-item ${item.undoneAt ? 'subtle' : ''}`;
      wrapper.appendChild(createNote([
        `${item.kind} • ${item.operationCount} ops`,
        item.createdAt,
        item.name,
        item.undoneAt ? `Undone: ${item.undoneAt}` : 'Ready to undo',
      ], 'note-lines'));
      if (!item.undoneAt) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ghost-button inline-button';
        button.textContent = 'Undo this run';
        button.addEventListener('click', () => runUndo(item.name));
        wrapper.appendChild(button);
      }
      return wrapper;
    });
    updateActionLabels();
  }

  async function runUndo(name) {
    const result = await api.undo(name ? { name } : {});
    await loadUndoLogs();
    if (state.currentSource) await loadSourceStats(state.currentSource);
    const container = els.undoLogList;
    container.prepend(createNote([
      `Undo applied: ${result.kind}`,
      `${result.operationCount} operations reversed`,
      result.name,
    ], 'log-item success'));
  }

  async function runUndoByKinds(kinds, container) {
    const log = latestUndoLog(kinds);
    if (!log) return;
    const result = await api.undo({ name: log.name });
    await loadUndoLogs();
    if (state.currentSource) await loadSourceStats(state.currentSource);
    if (container) {
      container.prepend(createNote([
        `Undo applied: ${result.kind}`,
        `${result.operationCount} operations reversed`,
        result.name,
      ], 'log-item success'));
    }
  }

  async function runDiagnostics() {
    const path = els.sourcePath.value.trim();
    if (!path) return;
    const result = await api.diagnose({ path });
    clearNode(els.sourceDiagnostics);
    els.sourceDiagnostics.appendChild(createNote([
      `Filesystem entries: ${formatNumber(result.entries)}`,
      `Sortable files: ${formatNumber(result.sortableFiles)}`,
      `Folders: ${formatNumber(result.folders)}`,
      `Packages counted as files: ${formatNumber(result.packages)}`,
      `Hidden entries: ${formatNumber(result.hidden)}`,
      `Symlinks / aliases: ${formatNumber(result.symlinks)}`,
    ]));
    (result.special || []).slice(0, 8).forEach(item => {
      els.sourceDiagnostics.appendChild(createNote([item.type, item.path], 'log-item subtle'));
    });
  }

  async function refreshPicker(pathValue) {
    const payload = await api.getDirectories(pathValue);
    state.currentPickerPath = payload.path;
    els.pickerPath.textContent = payload.path;
    clearNode(els.pickerRoots);
    payload.roots.forEach(root => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'root-chip';
      button.textContent = root.name;
      button.addEventListener('click', () => refreshPicker(root.path));
      els.pickerRoots.appendChild(button);
    });
    clearNode(els.pickerStats);
    [
      ['Items', payload.stats.items],
      ['Files', payload.stats.files],
      ['Folders', payload.stats.folders],
      ['Sortable', payload.stats.sortableFiles ?? payload.stats.files],
    ].forEach(([label, value]) => {
      const card = document.createElement('div');
      card.className = 'mini-stat';
      card.innerHTML = `<span>${label}</span><strong>${formatNumber(value)}</strong>`;
      els.pickerStats.appendChild(card);
    });
    clearNode(els.pickerList);
    els.pickerParentBtn.disabled = !payload.parent;
    if (payload.directories.length === 0) {
      els.pickerList.appendChild(createNote(['No subfolders here.'], 'empty-note'));
      return;
    }
    payload.directories.forEach(dir => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'picker-row';
      button.innerHTML = `<span>${basename(dir.name)}</span><small>${dir.path}</small>`;
      button.addEventListener('click', () => refreshPicker(dir.path));
      els.pickerList.appendChild(button);
    });
  }

  async function openPicker(target, initialPath) {
    state.currentPickerTarget = target;
    state.currentPickerPath = initialPath || state.currentSource || '/';
    els.pickerTitle.textContent = `Select ${target}`;
    els.pickerModal.classList.remove('hidden');
    await refreshPicker(state.currentPickerPath);
  }

  function closePicker() {
    els.pickerModal.classList.add('hidden');
  }

  async function runSort() {
    const result = await api.sort({
      source: els.sourcePath.value.trim(),
      dest: els.destPath.value.trim(),
      recursive: els.includeSubfolders.checked,
      copy: els.copyInsteadOfMove.checked,
      dry_run: els.sortPreviewOnly.checked,
      group_by: getSortGroupBy(),
      size_rule: sizeRulePayload(),
    });
    renderLogList(els.sortPreviewList, result.preview || [], item => createNote([
      item.source,
      `-> ${item.destination}`,
      `${formatBytes(item.size)} • ${item.folderKey}`,
    ]));
    els.sortPreviewList.prepend(createNote([
      result.dry_run ? 'Sorting preview ready' : 'Sorting complete',
      `Files affected: ${formatNumber(result.total)}`,
      `Skipped by size rule: ${formatNumber(result.skippedBySizeRule)}`,
    ], result.dry_run ? 'log-item' : 'log-item success'));
    if (result.undoLog) {
      els.sortPreviewList.prepend(createNote(['Undo log created', result.undoLog], 'log-item success'));
      await loadUndoLogs();
      await loadSourceStats(els.sourcePath.value);
    }
  }

  async function runCompare(previewOnly) {
    const result = await api.compare({
      folderA: els.compareFolderA.value.trim(),
      folderB: els.compareFolderB.value.trim(),
      match_by: els.compareMatchBy.value,
      direction: els.compareDirection.value,
      verify_contents: els.compareVerifyContents.checked,
      replace_different: els.compareReplaceDifferent.checked,
      delete_target_only: els.compareDeleteTargetOnly.checked,
      preview_only: previewOnly,
    });
    state.comparePreviewSeen = true;
    updateActionLabels();
    els.onlyInACount.textContent = `${formatNumber(result.onlyInA.length)} files`;
    els.differentCount.textContent = `${formatNumber(result.different.length)} files`;
    els.onlyInBCount.textContent = `${formatNumber(result.onlyInB.length)} files`;
    renderLogList(els.onlyInAList, result.onlyInA, item => createNote([item.relative, `${formatBytes(item.size)} • ${item.modifiedAt}`], 'result-item'));
    renderLogList(els.onlyInBList, result.onlyInB, item => createNote([item.relative, `${formatBytes(item.size)} • ${item.modifiedAt}`], 'result-item'));
    renderLogList(els.differentList, result.different, item => createNote([
      item.a.relative,
      `A: ${formatBytes(item.a.size)} • ${item.a.modifiedAt}`,
      `B: ${formatBytes(item.b.size)} • ${item.b.modifiedAt}`,
    ], 'result-item'));
    renderLogList(els.compareActionPreview, result.actionPlan || [], item => createNote([
      item.action,
      item.relative,
      item.source ? `from: ${item.source}` : 'from: target only',
      `to: ${item.destination}`,
    ]));
    if (result.undoLog) {
      els.compareActionPreview.prepend(createNote(['Undo log created', result.undoLog], 'log-item success'));
      await loadUndoLogs();
    }
  }

  async function runRename(previewOnly) {
    const result = await api.renameFiles({
      source: els.utilityPath.value.trim(),
      trim_whitespace: els.renameTrimWhitespace.checked,
      replace_spaces: els.renameReplaceSpaces.checked,
      remove_special_chars: els.renameRemoveSpecial.checked,
      add_date_prefix: els.renameAddDatePrefix.checked,
      sequence: els.renameSequence.checked,
      preview_only: previewOnly,
    });
    renderLogList(els.renamePreviewList, result.preview || [], item => createNote([item.source, `-> ${item.destination}`]));
    els.renamePreviewList.prepend(createNote([
      previewOnly ? 'Rename preview ready' : 'Renaming complete',
      `Files affected: ${formatNumber(result.total)}`,
    ], previewOnly ? 'log-item' : 'log-item success'));
    if (result.undoLog) {
      els.renamePreviewList.prepend(createNote(['Undo log created', result.undoLog], 'log-item success'));
      await loadUndoLogs();
    }
  }

  async function runDuplicates() {
    const result = await api.findDuplicates({
      source: els.utilityPath.value.trim(),
      mode: els.duplicateMode.value,
      keep_rule: els.duplicateKeepRule.value,
      delete_duplicates: els.duplicateDeleteMode.checked,
    });
    renderLogList(els.duplicateResults, result.groups || [], group => {
      const lines = [
        `Keep rule: ${result.keepRule === 'latest' ? 'latest created file' : 'earliest created file'}`,
        `Keep: ${group.keep.path}`,
        `Created: ${group.keep.createdAt}`,
      ];
      group.remove.forEach(item => lines.push(`Delete: ${item.path}`));
      return createNote(lines, els.duplicateDeleteMode.checked ? 'log-item warning' : 'log-item');
    });
    if (result.undoLog) {
      els.duplicateResults.prepend(createNote(['Undo log created', result.undoLog], 'log-item success'));
      await loadUndoLogs();
    }
  }

  async function runEmptyFolders() {
    const result = await api.emptyFolders({
      source: els.utilityPath.value.trim(),
      preview_only: els.emptyFolderPreviewOnly.checked,
    });
    renderLogList(els.emptyFolderResults, result.folders || [], folder => createNote([folder]));
    els.emptyFolderResults.prepend(createNote([
      result.preview_only ? 'Empty folder preview' : 'Empty folders deleted',
      `${formatNumber(result.total)} folders`,
    ], result.preview_only ? 'log-item' : 'log-item success'));
    if (result.undoLog) {
      els.emptyFolderResults.prepend(createNote(['Undo log created', result.undoLog], 'log-item success'));
      await loadUndoLogs();
    }
  }

  async function runFlatten() {
    const result = await api.flatten({
      source: els.utilityPath.value.trim(),
      delete_empty_folders: els.deleteEmptyFolders.checked,
      dry_run: els.dryRunUtility.checked,
    });
    renderLogList(els.utilityLog, result.plan || [], item => createNote([item.source, `-> ${item.destination}`]));
    els.utilityLog.prepend(createNote([
      result.dry_run ? 'Flatten preview ready' : 'Flatten complete',
      `Files that would move to source: ${formatNumber(result.wouldMoveToSource)}`,
      `Empty folders affected: ${formatNumber(result.emptyFoldersDeleted)}`,
    ], result.dry_run ? 'log-item' : 'log-item success'));
    if (result.undoLog) {
      els.utilityLog.prepend(createNote(['Undo log created', result.undoLog], 'log-item success'));
      await loadUndoLogs();
    }
  }

  function bindEvents() {
    els.tabs.forEach(tab => tab.addEventListener('click', () => setActiveTab(tab.dataset.tab)));
    els.loadSourceBtn.addEventListener('click', () => loadSourceStats(els.sourcePath.value).catch(showError));
    els.refreshLogsBtn.addEventListener('click', () => loadUndoLogs().catch(showError));
    els.undoLatestBtn.addEventListener('click', () => runUndo().catch(showError));
    els.sortUndoBtn.addEventListener('click', () => runUndoByKinds(['sort'], els.sortPreviewList).catch(showError));
    els.diagnoseSourceBtn.addEventListener('click', () => runDiagnostics().catch(showError));
    els.sortBtn.addEventListener('click', () => runSort().catch(showError));
    els.runCompareBtn.addEventListener('click', () => {
      els.comparePreviewOnly.checked = true;
      updateActionLabels();
      runCompare(true).catch(showError);
    });
    els.applyCompareBtn.addEventListener('click', () => {
      els.comparePreviewOnly.checked = false;
      updateActionLabels();
      runCompare(false).catch(showError);
    });
    els.compareUndoBtn.addEventListener('click', () => runUndoByKinds(['compare-sync'], els.compareActionPreview).catch(showError));
    els.previewRenameBtn.addEventListener('click', () => runRename(true).catch(showError));
    els.applyRenameBtn.addEventListener('click', () => runRename(false).catch(showError));
    els.renameUndoBtn.addEventListener('click', () => runUndoByKinds(['file-name-cleaner'], els.renamePreviewList).catch(showError));
    els.findDuplicatesBtn.addEventListener('click', () => runDuplicates().catch(showError));
    els.duplicateUndoBtn.addEventListener('click', () => runUndoByKinds(['duplicate-cleanup'], els.duplicateResults).catch(showError));
    els.runEmptyFolderBtn.addEventListener('click', () => runEmptyFolders().catch(showError));
    els.emptyUndoBtn.addEventListener('click', () => runUndoByKinds(['empty-folder-cleaner'], els.emptyFolderResults).catch(showError));
    els.flattenBtn.addEventListener('click', () => runFlatten().catch(showError));
    els.flattenUndoBtn.addEventListener('click', () => runUndoByKinds(['flatten'], els.utilityLog).catch(showError));

    els.sortPreviewOnly.addEventListener('change', updateActionLabels);
    els.dryRunUtility.addEventListener('change', updateActionLabels);
    els.compareProtectedMode.addEventListener('change', updateActionLabels);
    els.comparePreviewOnly.addEventListener('change', updateActionLabels);
    document.querySelectorAll('input[name="sortGroup"]').forEach(input => input.addEventListener('change', updateActionLabels));
    els.sourcePath.addEventListener('input', updateActionLabels);
    els.utilityPath.addEventListener('input', () => {
      state.utilityOverridden = true;
      updateActionLabels();
    });
    els.sourcePath.addEventListener('change', () => loadSourceStats(els.sourcePath.value).catch(showError));
    els.loadUtilityBtn.addEventListener('click', () => {
      state.utilityOverridden = true;
      updateActionLabels();
    });

    els.browseSourceBtn.addEventListener('click', () => openPicker('source folder', els.sourcePath.value.trim()));
    els.browseDestBtn.addEventListener('click', () => openPicker('destination folder', els.destPath.value.trim() || els.sourcePath.value.trim()));
    els.browseUtilityBtn.addEventListener('click', () => openPicker('utility folder', els.utilityPath.value.trim() || els.sourcePath.value.trim()));
    els.browseCompareABtn.addEventListener('click', () => openPicker('Folder A', els.compareFolderA.value.trim() || els.sourcePath.value.trim()));
    els.browseCompareBBtn.addEventListener('click', () => openPicker('Folder B', els.compareFolderB.value.trim() || els.sourcePath.value.trim()));

    els.pickerParentBtn.addEventListener('click', async () => {
      const payload = await api.getDirectories(state.currentPickerPath);
      if (payload.parent) await refreshPicker(payload.parent);
    });
    els.pickerUseBtn.addEventListener('click', async () => {
      const value = state.currentPickerPath;
      if (state.currentPickerTarget === 'source folder') {
        els.sourcePath.value = value;
        await loadSourceStats(value);
      } else if (state.currentPickerTarget === 'destination folder') {
        els.destPath.value = value;
      } else if (state.currentPickerTarget === 'utility folder') {
        state.utilityOverridden = true;
        els.utilityPath.value = value;
      } else if (state.currentPickerTarget === 'Folder A') {
        els.compareFolderA.value = value;
      } else if (state.currentPickerTarget === 'Folder B') {
        els.compareFolderB.value = value;
      }
      updateActionLabels();
      closePicker();
    });
    els.closePickerBtn.addEventListener('click', closePicker);
    els.pickerModal.addEventListener('click', event => {
      if (event.target === els.pickerModal) closePicker();
    });
  }

  async function init() {
    bindEvents();
    const hash = location.hash.replace('#', '');
    if (hash === 'utilities') setActiveTab('utilities');
    updateActionLabels();
    await loadUndoLogs();
    if (els.sourcePath.value.trim()) await loadSourceStats(els.sourcePath.value);
  }

  init().catch(showError);
})();
