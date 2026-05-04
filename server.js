/*
 * fileSorter
 * Created: 2026-05-04
 * Created by lgtaegi
 */
const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 5000);
const baseDir = __dirname;
const undoLogDir = path.join(baseDir, 'undo-logs');
const undoBackupDir = path.join(baseDir, 'undo-backups');
const PACKAGE_EXTENSIONS = new Set(['app', 'pages', 'numbers', 'key', 'rtfd', 'photoslibrary', 'pkg']);
const CATEGORY_GROUPS = {
  images: new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'tif', 'tiff', 'bmp', 'svg']),
  documents: new Set(['pdf', 'doc', 'docx', 'txt', 'rtf', 'pages', 'md', 'csv', 'xls', 'xlsx', 'ppt', 'pptx']),
  videos: new Set(['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v']),
  audio: new Set(['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg']),
  archives: new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2']),
  code: new Set(['js', 'ts', 'tsx', 'jsx', 'py', 'json', 'html', 'css', 'scss', 'md', 'yml', 'yaml']),
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, text, contentType = 'text/plain') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5_000_000) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function resolveUserPath(input, fallback = '.') {
  const raw = String(input || fallback).trim() || fallback;
  return path.resolve(raw.replace(/^~/, os.homedir()));
}

async function pathIsDirectory(filePath) {
  try {
    return (await fsp.stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

async function pathIsFile(filePath) {
  try {
    return (await fsp.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function isHiddenName(name) {
  return name.startsWith('.') && name !== '.' && name !== '..';
}

function isPackageName(name) {
  const ext = name.toLowerCase().split('.').pop();
  return PACKAGE_EXTENSIONS.has(ext);
}

function isMacMetadataFile(name) {
  return name === '.DS_Store' || name.startsWith('._');
}

function targetFolderFor(filePath) {
  const ext = path.extname(filePath).toLowerCase().replace(/^\./, '');
  return ext || 'no_extension';
}

function categoryFolderFor(filePath) {
  const ext = targetFolderFor(filePath);
  for (const [category, set] of Object.entries(CATEGORY_GROUPS)) {
    if (set.has(ext)) return category;
  }
  return 'other';
}

function normalizeGroupBy(value) {
  const allowed = new Set(['year', 'month', 'day', 'type', 'category']);
  if (!Array.isArray(value)) return ['type'];
  const groupBy = value.filter(item => allowed.has(item));
  return groupBy.length ? groupBy : ['type'];
}

function parseSizeRule(input) {
  if (!input || !input.enabled) return null;
  const value = Number(input.value);
  const comparator = input.comparator === 'at_most' ? 'at_most' : 'at_least';
  const unit = ['B', 'KB', 'MB', 'GB'].includes(input.unit) ? input.unit : 'MB';
  if (!Number.isFinite(value) || value < 0) return null;
  const scales = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
  return {
    comparator,
    unit,
    value,
    bytes: value * scales[unit],
    label: `${comparator}_${value}${unit}`,
  };
}

function matchesSizeRule(size, rule) {
  if (!rule) return true;
  return rule.comparator === 'at_most' ? size <= rule.bytes : size >= rule.bytes;
}

function folderPartsFor(filePath, groupBy, stat) {
  const date = new Date(stat.mtimeMs);
  const parts = [];
  for (const group of groupBy) {
    if (group === 'year') parts.push(String(date.getFullYear()));
    else if (group === 'month') parts.push(String(date.getMonth() + 1).padStart(2, '0'));
    else if (group === 'day') parts.push(String(date.getDate()).padStart(2, '0'));
    else if (group === 'type') parts.push(targetFolderFor(filePath));
    else if (group === 'category') parts.push(categoryFolderFor(filePath));
  }
  return parts.length ? parts : [targetFolderFor(filePath)];
}

function ensureUniqueTarget(dstDir, name) {
  let candidate = path.join(dstDir, name);
  if (!fs.existsSync(candidate)) return candidate;
  const parsed = path.parse(name);
  let i = 1;
  while (true) {
    candidate = path.join(dstDir, `${parsed.name}_${i}${parsed.ext}`);
    if (!fs.existsSync(candidate)) return candidate;
    i += 1;
  }
}

async function copyFile(src, dst) {
  await fsp.mkdir(path.dirname(dst), { recursive: true });
  await fsp.copyFile(src, dst);
  const stat = await fsp.stat(src);
  await fsp.utimes(dst, stat.atime, stat.mtime);
}


async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function collectEntries(dir, recursive = true) {
  const files = [];

  async function walk(current) {
    const entries = await fsp.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (isHiddenName(entry.name)) continue;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (isPackageName(entry.name)) continue;
        if (recursive) await walk(entryPath);
        continue;
      }
      if (entry.isFile()) files.push(entryPath);
    }
  }

  await walk(dir);
  return files;
}

async function getFileRecord(filePath, root) {
  const stat = await fsp.stat(filePath);
  return {
    path: filePath,
    relative: path.relative(root, filePath),
    name: path.basename(filePath),
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    createdAt: new Date(stat.birthtimeMs || stat.ctimeMs || stat.mtimeMs).toISOString(),
  };
}

async function collectDiagnostics(dir, recursive = true) {
  const summary = {
    entries: 0,
    files: 0,
    folders: 0,
    packages: 0,
    hidden: 0,
    symlinks: 0,
    sortableFiles: 0,
    special: [],
  };

  async function walk(current) {
    let entries;
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      summary.entries += 1;

      let stat;
      try {
        stat = await fsp.lstat(entryPath);
      } catch {
        summary.special.push({ type: 'other', path: entryPath });
        continue;
      }

      if (stat.isSymbolicLink()) {
        summary.symlinks += 1;
        summary.special.push({ type: 'symlink', path: entryPath });
        continue;
      }
      if (isHiddenName(entry.name)) {
        summary.hidden += 1;
        summary.special.push({ type: 'hidden', path: entryPath });
        continue;
      }
      if (entry.isDirectory()) {
        if (isPackageName(entry.name)) {
          summary.packages += 1;
          summary.sortableFiles += 1;
          summary.special.push({ type: 'package', path: entryPath });
          continue;
        }
        summary.folders += 1;
        if (recursive) await walk(entryPath);
        continue;
      }
      if (entry.isFile()) {
        summary.files += 1;
        summary.sortableFiles += 1;
        continue;
      }
      summary.special.push({ type: 'other', path: entryPath });
    }
  }

  await walk(dir);
  return summary;
}

async function ensureUndoDirs() {
  await fsp.mkdir(undoLogDir, { recursive: true });
  await fsp.mkdir(undoBackupDir, { recursive: true });
}

function buildLogId(kind) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${kind}-${rand}`;
}

async function createUndoSession(kind, meta = {}) {
  await ensureUndoDirs();
  const id = buildLogId(kind);
  const session = {
    id,
    kind,
    meta,
    createdAt: new Date().toISOString(),
    operations: [],
    undoneAt: null,
    backupDir: path.join(undoBackupDir, id),
    logPath: path.join(undoLogDir, `${id}.json`),
  };
  await fsp.mkdir(session.backupDir, { recursive: true });
  return session;
}

async function backupPathForUndo(targetPath, session, prefix = 'backup') {
  await fsp.mkdir(session.backupDir, { recursive: true });
  const candidateName = `${prefix}-${path.basename(targetPath)}`;
  const backupPath = ensureUniqueTarget(session.backupDir, candidateName);
  await copyFile(targetPath, backupPath);
  return backupPath;
}

async function removeEmptyAncestors(startDir) {
  let current = startDir;
  while (current && current !== path.dirname(current)) {
    let entries;
    try {
      entries = await fsp.readdir(current);
    } catch {
      return;
    }
    if (entries.length > 0) return;
    try {
      await fsp.rmdir(current);
    } catch {
      return;
    }
    current = path.dirname(current);
  }
}

async function finalizeUndoSession(session) {
  const payload = {
    id: session.id,
    kind: session.kind,
    meta: session.meta,
    createdAt: session.createdAt,
    undoneAt: session.undoneAt,
    operations: session.operations,
  };
  await fsp.writeFile(session.logPath, JSON.stringify(payload, null, 2));
  return session.logPath;
}

async function loadUndoPayloadByName(name) {
  await ensureUndoDirs();
  const files = (await fsp.readdir(undoLogDir))
    .filter(fileName => fileName.endsWith('.json'))
    .sort()
    .reverse();

  let filePath;
  if (name) {
    filePath = path.join(undoLogDir, name);
    if (!fs.existsSync(filePath)) throw new Error(`Undo log not found: ${name}`);
  } else {
    if (files.length === 0) throw new Error('No undo logs available');
    filePath = path.join(undoLogDir, files[0]);
  }

  const raw = await fsp.readFile(filePath, 'utf8');
  return {
    filePath,
    payload: JSON.parse(raw),
  };
}

async function undoOperation(operation) {
  if (operation.action === 'copy') {
    if (operation.newPath && fs.existsSync(operation.newPath)) {
      await fsp.unlink(operation.newPath);
      await removeEmptyAncestors(path.dirname(operation.newPath));
    }
    return;
  }

  if (operation.action === 'move' || operation.action === 'rename') {
    if (operation.newPath && fs.existsSync(operation.newPath)) {
      await fsp.mkdir(path.dirname(operation.oldPath), { recursive: true });
      await fsp.rename(operation.newPath, operation.oldPath);
      await removeEmptyAncestors(path.dirname(operation.newPath));
    }
    return;
  }

  if (operation.action === 'replace') {
    if (!operation.backupPath || !fs.existsSync(operation.backupPath)) {
      throw new Error(`Missing backup for replace: ${operation.newPath}`);
    }
    await copyFile(operation.backupPath, operation.newPath);
    return;
  }

  if (operation.action === 'delete') {
    if (!operation.backupPath || !fs.existsSync(operation.backupPath)) {
      throw new Error(`Missing backup for delete: ${operation.oldPath}`);
    }
    await copyFile(operation.backupPath, operation.oldPath);
    return;
  }

  if (operation.action === 'delete_folder') {
    await fsp.mkdir(operation.oldPath, { recursive: true });
    return;
  }
}

async function applyUndo(payload) {
  const operations = [...(payload.operations || [])].reverse();
  for (const operation of operations) {
    await undoOperation(operation);
  }
}

async function buildSortPlan(source, dest, options) {
  const files = await collectEntries(source, options.recursive);
  const counts = {};
  const plan = [];
  let skippedBySizeRule = 0;
  const destInsideSource = dest !== source && dest.startsWith(`${source}${path.sep}`);

  for (const file of files) {
    const stat = await fsp.stat(file);
    if (!matchesSizeRule(stat.size, options.sizeRule)) {
      skippedBySizeRule += 1;
      continue;
    }
    if (destInsideSource) {
      const relativeToDest = path.relative(dest, file);
      if (relativeToDest && !relativeToDest.startsWith('..') && !path.isAbsolute(relativeToDest)) {
        continue;
      }
    }

    const parts = folderPartsFor(file, options.groupBy, stat);
    if (options.sizeRule) parts.push(options.sizeRule.label);
    const targetDir = path.join(dest, ...parts);
    const targetPath = path.join(targetDir, path.basename(file));
    if (path.resolve(targetPath) === path.resolve(file)) continue;

    const destination = ensureUniqueTarget(targetDir, path.basename(file));
    const folderKey = path.join(...parts);
    counts[folderKey] = (counts[folderKey] || 0) + 1;
    plan.push({
      source: file,
      destination,
      folderKey,
      size: stat.size,
    });
  }

  return {
    counts,
    total: plan.length,
    skippedBySizeRule,
    plan,
  };
}

async function applySortPlan(plan, options, session) {
  for (const item of plan) {
    await fsp.mkdir(path.dirname(item.destination), { recursive: true });
    if (options.copy) {
      await copyFile(item.source, item.destination);
      session.operations.push({ action: 'copy', oldPath: item.source, newPath: item.destination });
    } else {
      await fsp.rename(item.source, item.destination);
      session.operations.push({ action: 'move', oldPath: item.source, newPath: item.destination });
    }
  }
}

async function collectFlattenTargets(source) {
  const files = await collectEntries(source, true);
  return files.map(filePath => ({
    source: filePath,
    destination: ensureUniqueTarget(source, path.basename(filePath)),
    isAlreadyInRoot: path.dirname(path.relative(source, filePath)) === '.',
  }));
}

async function previewEmptyFoldersAfterFlatten(source) {
  let count = 0;

  async function walk(current, isRoot = false) {
    const entries = await fsp.readdir(current, { withFileTypes: true });
    let wouldBeEmpty = true;
    for (const entry of entries) {
      if (entry.isSymbolicLink() || isPackageName(entry.name)) {
        wouldBeEmpty = false;
        continue;
      }
      if (entry.isFile() && isMacMetadataFile(entry.name)) continue;
      if (entry.isDirectory() && isHiddenName(entry.name)) {
        wouldBeEmpty = false;
        continue;
      }
      if (entry.isFile()) {
        wouldBeEmpty = false;
        continue;
      }
      if (entry.isDirectory()) {
        const childEmpty = await walk(path.join(current, entry.name), false);
        if (!childEmpty) wouldBeEmpty = false;
      }
    }
    if (!isRoot && wouldBeEmpty) count += 1;
    return wouldBeEmpty;
  }

  await walk(source, true);
  return count;
}

async function removeEmptyFolders(source) {
  const removed = [];

  async function walk(current, isRoot = false) {
    const entries = await fsp.readdir(current, { withFileTypes: true });
    let empty = true;
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isSymbolicLink() || isPackageName(entry.name)) {
        empty = false;
        continue;
      }
      if (entry.isFile() && isMacMetadataFile(entry.name)) continue;
      if (entry.isDirectory() && isHiddenName(entry.name)) {
        empty = false;
        continue;
      }
      if (entry.isFile()) {
        empty = false;
        continue;
      }
      if (entry.isDirectory()) {
        const childEmpty = await walk(entryPath, false);
        if (!childEmpty) empty = false;
      }
    }
    if (!isRoot && empty) {
      await fsp.rmdir(current);
      removed.push(current);
    }
    return empty;
  }

  await walk(source, true);
  return removed;
}

async function flattenDir(source, options, session) {
  const plan = await collectFlattenTargets(source);
  const actionable = plan.filter(item => !item.isAlreadyInRoot);

  if (!options.dryRun) {
    for (const item of actionable) {
      await fsp.rename(item.source, item.destination);
      session.operations.push({ action: 'move', oldPath: item.source, newPath: item.destination });
    }
  }

  let deletedFolders = [];
  if (options.deleteEmptyFolders && !options.dryRun) {
    deletedFolders = await removeEmptyFolders(source);
    deletedFolders.forEach(folder => {
      session.operations.push({ action: 'delete_folder', oldPath: folder, newPath: null });
    });
  }

  return {
    before: { files: plan.length },
    after: { files: plan.length },
    foundFiles: plan.length,
    alreadyInSource: plan.length - actionable.length,
    wouldMoveToSource: actionable.length,
    filesInSourceAfter: plan.length,
    emptyFoldersDeleted: options.deleteEmptyFolders
      ? (options.dryRun ? await previewEmptyFoldersAfterFlatten(source) : deletedFolders.length)
      : 0,
    dry_run: options.dryRun,
    plan: actionable.slice(0, 300).map(item => ({ source: item.source, destination: item.destination })),
  };
}

function buildCompareKey(record, mode) {
  return mode === 'name_size' ? `${record.name}::${record.size}` : `${record.relative}::${record.size}`;
}

async function collectCompareMap(root, mode, verifyContents) {
  const files = await collectEntries(root, true);
  const map = new Map();
  for (const filePath of files) {
    const record = await getFileRecord(filePath, root);
    if (verifyContents) record.hash = await hashFile(filePath);
    map.set(buildCompareKey(record, mode), record);
  }
  return map;
}

async function compareFolders(folderA, folderB, options) {
  const mode = options.matchBy === 'name_size' ? 'name_size' : 'path_size';
  const mapA = await collectCompareMap(folderA, mode, options.verifyContents);
  const mapB = await collectCompareMap(folderB, mode, options.verifyContents);
  const onlyInA = [];
  const onlyInB = [];
  const different = [];
  const same = [];
  const keys = new Set([...mapA.keys(), ...mapB.keys()]);

  for (const key of keys) {
    const a = mapA.get(key);
    const b = mapB.get(key);
    if (a && !b) {
      onlyInA.push(a);
      continue;
    }
    if (!a && b) {
      onlyInB.push(b);
      continue;
    }
    if (!a || !b) continue;
    const equal = options.verifyContents ? a.hash === b.hash : a.size === b.size;
    if (equal) same.push({ a, b });
    else different.push({ a, b });
  }

  return { onlyInA, onlyInB, different, same };
}

function buildCompareActionPlan(compareResult, folderA, folderB, options) {
  const direction = options.direction === 'b_to_a' ? 'b_to_a' : 'a_to_b';
  const sourceOnly = direction === 'a_to_b' ? compareResult.onlyInA : compareResult.onlyInB;
  const targetOnly = direction === 'a_to_b' ? compareResult.onlyInB : compareResult.onlyInA;
  const plan = [];

  for (const file of sourceOnly) {
    const destinationRoot = direction === 'a_to_b' ? folderB : folderA;
    plan.push({
      action: 'copy_missing',
      relative: file.relative,
      source: file.path,
      destination: path.join(destinationRoot, file.relative),
    });
  }

  if (options.replaceDifferent) {
    for (const pair of compareResult.different) {
      const sourceRecord = direction === 'a_to_b' ? pair.a : pair.b;
      const targetRecord = direction === 'a_to_b' ? pair.b : pair.a;
      plan.push({
        action: 'replace_different',
        relative: sourceRecord.relative,
        source: sourceRecord.path,
        destination: targetRecord.path,
      });
    }
  }

  if (options.deleteTargetOnly) {
    for (const file of targetOnly) {
      plan.push({
        action: 'delete_target_only',
        relative: file.relative,
        source: null,
        destination: file.path,
      });
    }
  }

  return { direction, plan };
}

async function applyComparePlan(actionPlan, session) {
  for (const item of actionPlan.plan) {
    if (item.action === 'copy_missing') {
      await copyFile(item.source, item.destination);
      session.operations.push({ action: 'copy', oldPath: item.source, newPath: item.destination });
      continue;
    }
    if (item.action === 'replace_different') {
      const backupPath = fs.existsSync(item.destination)
        ? await backupPathForUndo(item.destination, session, 'replace')
        : null;
      await copyFile(item.source, item.destination);
      session.operations.push({ action: 'replace', oldPath: item.source, newPath: item.destination, backupPath });
      continue;
    }
    if (item.action === 'delete_target_only') {
      const backupPath = await backupPathForUndo(item.destination, session, 'delete');
      await fsp.unlink(item.destination);
      session.operations.push({ action: 'delete', oldPath: item.destination, newPath: null, backupPath });
    }
  }
}

async function buildRenamePlan(source, options) {
  const files = await collectEntries(source, true);
  const plan = [];
  let sequence = Number(options.sequenceStart || 1);
  const datePrefix = options.addDatePrefix ? new Date().toISOString().slice(0, 10) : '';

  for (const filePath of files) {
    const parsed = path.parse(filePath);
    let nextName = parsed.name;
    if (options.trimWhitespace) nextName = nextName.trim();
    if (options.replaceSpaces) nextName = nextName.replace(/\s+/g, '_');
    if (options.removeSpecialChars) nextName = nextName.replace(/[^a-zA-Z0-9._-]/g, '');
    if (options.sequence) {
      nextName = `${String(sequence).padStart(3, '0')}_${nextName}`;
      sequence += 1;
    }
    if (datePrefix) nextName = `${datePrefix}_${nextName}`;
    const candidate = `${nextName}${parsed.ext}`;
    if (candidate !== parsed.base) {
      plan.push({ source: filePath, destination: ensureUniqueTarget(parsed.dir, candidate) });
    }
  }

  return plan;
}

async function applyRenamePlan(plan, session) {
  for (const item of plan) {
    await fsp.rename(item.source, item.destination);
    session.operations.push({ action: 'rename', oldPath: item.source, newPath: item.destination });
  }
}

async function buildDuplicateGroups(source, mode) {
  const files = await collectEntries(source, true);
  const groups = new Map();
  for (const filePath of files) {
    const stat = await fsp.stat(filePath);
    const record = await getFileRecord(filePath, source);
    let key;
    if (mode === 'name') key = record.name;
    else if (mode === 'size') key = String(stat.size);
    else key = `${stat.size}:${await hashFile(filePath)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.values()].filter(group => group.length > 1);
}

function chooseDuplicateKeep(group, keepRule) {
  const sorted = [...group].sort((a, b) => {
    const delta = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return keepRule === 'latest' ? -delta : delta;
  });
  return {
    keep: sorted[0],
    remove: sorted.slice(1),
  };
}

async function applyDuplicateDeletion(groups, keepRule, session) {
  const decisions = [];
  for (const group of groups) {
    const decision = chooseDuplicateKeep(group, keepRule);
    decisions.push(decision);
    for (const item of decision.remove) {
      const backupPath = await backupPathForUndo(item.path, session, 'duplicate');
      await fsp.unlink(item.path);
      session.operations.push({ action: 'delete', oldPath: item.path, newPath: null, backupPath });
    }
  }
  return decisions;
}

async function listEmptyFolders(source) {
  const folders = [];

  async function walk(current, isRoot = false) {
    const entries = await fsp.readdir(current, { withFileTypes: true });
    let empty = true;
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isSymbolicLink() || isPackageName(entry.name)) {
        empty = false;
        continue;
      }
      if (entry.isFile() && isMacMetadataFile(entry.name)) continue;
      if (entry.isDirectory() && isHiddenName(entry.name)) {
        empty = false;
        continue;
      }
      if (entry.isFile()) {
        empty = false;
        continue;
      }
      if (entry.isDirectory()) {
        const childEmpty = await walk(entryPath, false);
        if (!childEmpty) empty = false;
      }
    }
    if (!isRoot && empty) folders.push(current);
    return empty;
  }

  await walk(source, true);
  return folders;
}

async function removeListedFolders(folders, session) {
  const sorted = [...folders].sort((a, b) => b.length - a.length);
  for (const folder of sorted) {
    await fsp.rmdir(folder);
    session.operations.push({ action: 'delete_folder', oldPath: folder, newPath: null });
  }
}

async function handleDirectories(req, res, url) {
  const current = resolveUserPath(url.searchParams.get('path'), process.cwd());
  if (!await pathIsDirectory(current)) {
    sendJson(res, 400, { error: `${current} is not a directory` });
    return;
  }

  let entries;
  try {
    entries = await fsp.readdir(current, { withFileTypes: true });
  } catch {
    sendJson(res, 403, { error: `Permission denied: ${current}` });
    return;
  }

  const directories = entries
    .filter(entry => entry.isDirectory() && !isHiddenName(entry.name) && !entry.isSymbolicLink())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(entry => ({ name: entry.name, path: path.join(current, entry.name) }));

  const home = os.homedir();
  const roots = [
    { name: 'Current folder', path: process.cwd() },
    { name: 'Home', path: home },
    { name: 'Desktop', path: path.join(home, 'Desktop') },
    { name: 'Documents', path: path.join(home, 'Documents') },
    { name: 'Downloads', path: path.join(home, 'Downloads') },
  ].filter(root => fs.existsSync(root.path));

  const stats = await collectDiagnostics(current, false);
  const parent = path.dirname(current);
  sendJson(res, 200, {
    path: current,
    parent: parent === current ? null : parent,
    directories,
    roots,
    stats: {
      items: stats.entries,
      files: stats.files,
      folders: stats.folders,
      sortableFiles: stats.sortableFiles,
    },
  });
}

async function handleStats(req, res, url) {
  const current = resolveUserPath(url.searchParams.get('path'), process.cwd());
  if (!await pathIsDirectory(current)) {
    sendJson(res, 400, { error: `${current} is not a directory` });
    return;
  }

  try {
    const stats = await collectDiagnostics(current, true);
    sendJson(res, 200, {
      path: current,
      stats: {
        items: stats.entries,
        files: stats.files,
        folders: stats.folders,
        sortableFiles: stats.sortableFiles,
        packages: stats.packages,
        hidden: stats.hidden,
        symlinks: stats.symlinks,
      },
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleUndoLogs(req, res) {
  try {
    await ensureUndoDirs();
    const files = (await fsp.readdir(undoLogDir))
      .filter(name => name.endsWith('.json'))
      .sort()
      .reverse();
    const logs = [];
    for (const name of files.slice(0, 30)) {
      const raw = await fsp.readFile(path.join(undoLogDir, name), 'utf8');
      const payload = JSON.parse(raw);
      logs.push({
        name,
        path: path.join(undoLogDir, name),
        kind: payload.kind,
        createdAt: payload.createdAt,
        undoneAt: payload.undoneAt || null,
        operationCount: Array.isArray(payload.operations) ? payload.operations.length : 0,
      });
    }
    sendJson(res, 200, { logs });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleUndo(req, res) {
  let data;
  try {
    data = JSON.parse(await getRequestBody(req) || '{}');
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON' });
    return;
  }

  try {
    const loaded = await loadUndoPayloadByName(data.name);
    if (loaded.payload.undoneAt) {
      sendJson(res, 400, { error: 'This undo log has already been applied' });
      return;
    }
    await applyUndo(loaded.payload);
    loaded.payload.undoneAt = new Date().toISOString();
    await fsp.writeFile(loaded.filePath, JSON.stringify(loaded.payload, null, 2));
    sendJson(res, 200, {
      ok: true,
      name: path.basename(loaded.filePath),
      kind: loaded.payload.kind,
      undoneAt: loaded.payload.undoneAt,
      operationCount: Array.isArray(loaded.payload.operations) ? loaded.payload.operations.length : 0,
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleDiagnose(req, res) {
  let data;
  try {
    data = JSON.parse(await getRequestBody(req) || '{}');
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON' });
    return;
  }
  const current = resolveUserPath(data.path, process.cwd());
  if (!await pathIsDirectory(current)) {
    sendJson(res, 400, { error: `${current} is not a directory` });
    return;
  }
  try {
    const stats = await collectDiagnostics(current, true);
    sendJson(res, 200, {
      entries: stats.entries,
      sortableFiles: stats.sortableFiles,
      folders: stats.folders,
      packages: stats.packages,
      hidden: stats.hidden,
      symlinks: stats.symlinks,
      special: stats.special,
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleSort(req, res) {
  let data;
  try {
    data = JSON.parse(await getRequestBody(req) || '{}');
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON' });
    return;
  }

  const source = resolveUserPath(data.source, '.');
  const dest = data.dest ? resolveUserPath(data.dest, source) : source;
  if (!await pathIsDirectory(source)) {
    sendJson(res, 400, { error: `Source ${source} is not a directory` });
    return;
  }

  try {
    const result = await buildSortPlan(source, dest, {
      recursive: Boolean(data.recursive),
      groupBy: normalizeGroupBy(data.group_by),
      sizeRule: parseSizeRule(data.size_rule),
    });

    let undoLog = null;
    if (!data.dry_run) {
      const session = await createUndoSession('sort', { source, dest });
      await applySortPlan(result.plan, { copy: Boolean(data.copy) }, session);
      undoLog = await finalizeUndoSession(session);
    }

    sendJson(res, 200, {
      counts: result.counts,
      total: result.total,
      skippedBySizeRule: result.skippedBySizeRule,
      dry_run: Boolean(data.dry_run),
      preview: result.plan.slice(0, 250),
      previewTruncated: result.plan.length > 250,
      undoLog,
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleFlatten(req, res) {
  let data;
  try {
    data = JSON.parse(await getRequestBody(req) || '{}');
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON' });
    return;
  }

  const source = resolveUserPath(data.source, '.');
  if (!await pathIsDirectory(source)) {
    sendJson(res, 400, { error: `Source ${source} is not a directory` });
    return;
  }

  try {
    const session = data.dry_run ? null : await createUndoSession('flatten', { source });
    const result = await flattenDir(source, {
      deleteEmptyFolders: Boolean(data.delete_empty_folders),
      dryRun: Boolean(data.dry_run),
    }, session || { operations: [] });
    const undoLog = session ? await finalizeUndoSession(session) : null;
    sendJson(res, 200, { ...result, undoLog });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleCompare(req, res) {
  let data;
  try {
    data = JSON.parse(await getRequestBody(req) || '{}');
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON' });
    return;
  }

  const folderA = resolveUserPath(data.folderA, '.');
  const folderB = resolveUserPath(data.folderB, '.');
  if (!await pathIsDirectory(folderA) || !await pathIsDirectory(folderB)) {
    sendJson(res, 400, { error: 'Both Folder A and Folder B must be valid directories' });
    return;
  }

  try {
    const compareResult = await compareFolders(folderA, folderB, {
      matchBy: data.match_by,
      verifyContents: Boolean(data.verify_contents),
    });
    const actionPlan = buildCompareActionPlan(compareResult, folderA, folderB, {
      direction: data.direction,
      replaceDifferent: Boolean(data.replace_different),
      deleteTargetOnly: Boolean(data.delete_target_only),
    });

    let undoLog = null;
    if (!data.preview_only) {
      const session = await createUndoSession('compare-sync', { folderA, folderB, direction: actionPlan.direction });
      await applyComparePlan(actionPlan, session);
      undoLog = await finalizeUndoSession(session);
    }

    sendJson(res, 200, {
      onlyInA: compareResult.onlyInA,
      different: compareResult.different,
      onlyInB: compareResult.onlyInB,
      sameCount: compareResult.same.length,
      preview_only: Boolean(data.preview_only),
      actionPlan: actionPlan.plan.slice(0, 300),
      actionPlanTruncated: actionPlan.plan.length > 300,
      undoLog,
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleRename(req, res) {
  let data;
  try {
    data = JSON.parse(await getRequestBody(req) || '{}');
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON' });
    return;
  }

  const source = resolveUserPath(data.source, '.');
  if (!await pathIsDirectory(source)) {
    sendJson(res, 400, { error: `Source ${source} is not a directory` });
    return;
  }

  try {
    const plan = await buildRenamePlan(source, {
      trimWhitespace: Boolean(data.trim_whitespace),
      replaceSpaces: Boolean(data.replace_spaces),
      removeSpecialChars: Boolean(data.remove_special_chars),
      addDatePrefix: Boolean(data.add_date_prefix),
      sequence: Boolean(data.sequence),
      sequenceStart: data.sequence_start,
    });

    let undoLog = null;
    if (!data.preview_only) {
      const session = await createUndoSession('file-name-cleaner', { source });
      await applyRenamePlan(plan, session);
      undoLog = await finalizeUndoSession(session);
    }

    sendJson(res, 200, {
      preview_only: Boolean(data.preview_only),
      total: plan.length,
      preview: plan.slice(0, 250),
      previewTruncated: plan.length > 250,
      undoLog,
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleDuplicates(req, res) {
  let data;
  try {
    data = JSON.parse(await getRequestBody(req) || '{}');
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON' });
    return;
  }

  const source = resolveUserPath(data.source, '.');
  if (!await pathIsDirectory(source)) {
    sendJson(res, 400, { error: `Source ${source} is not a directory` });
    return;
  }

  try {
    const mode = ['name', 'size', 'hash'].includes(data.mode) ? data.mode : 'hash';
    const keepRule = data.keep_rule === 'latest' ? 'latest' : 'earliest';
    const groups = await buildDuplicateGroups(source, mode);
    const previewGroups = groups.map(group => chooseDuplicateKeep(group, keepRule));

    let undoLog = null;
    if (Boolean(data.delete_duplicates)) {
      const session = await createUndoSession('duplicate-cleanup', { source, mode, keepRule });
      await applyDuplicateDeletion(groups, keepRule, session);
      undoLog = await finalizeUndoSession(session);
    }

    sendJson(res, 200, {
      mode,
      deleteDuplicates: Boolean(data.delete_duplicates),
      keepRule,
      groups: previewGroups,
      undoLog,
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleEmptyFolders(req, res) {
  let data;
  try {
    data = JSON.parse(await getRequestBody(req) || '{}');
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON' });
    return;
  }

  const source = resolveUserPath(data.source, '.');
  if (!await pathIsDirectory(source)) {
    sendJson(res, 400, { error: `Source ${source} is not a directory` });
    return;
  }

  try {
    const folders = await listEmptyFolders(source);
    let undoLog = null;
    if (!Boolean(data.preview_only)) {
      const session = await createUndoSession('empty-folder-cleaner', { source });
      await removeListedFolders(folders, session);
      undoLog = await finalizeUndoSession(session);
    }

    sendJson(res, 200, {
      preview_only: Boolean(data.preview_only),
      total: folders.length,
      folders,
      undoLog,
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function serveIndex(res) {
  const html = await fsp.readFile(path.join(baseDir, 'index.html'), 'utf8');
  sendText(res, 200, html, 'text/html; charset=utf-8');
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/utility' || url.pathname === '/utility.html')) {
    await serveIndex(res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/directories') {
    await handleDirectories(req, res, url);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/stats') {
    await handleStats(req, res, url);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/undo-logs') {
    await handleUndoLogs(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/undo') {
    await handleUndo(req, res);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/diagnose') {
    await handleDiagnose(req, res);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/sort') {
    await handleSort(req, res);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/flatten') {
    await handleFlatten(req, res);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/compare') {
    await handleCompare(req, res);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/rename-files') {
    await handleRename(req, res);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/find-duplicates') {
    await handleDuplicates(req, res);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/empty-folders') {
    await handleEmptyFolders(req, res);
    return;
  }
  if (req.method === 'GET' && await pathIsFile(path.join(baseDir, url.pathname))) {
    const filePath = path.join(baseDir, url.pathname);
    const data = await fsp.readFile(filePath);
    res.writeHead(200);
    res.end(data);
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(error => sendJson(res, 500, { error: error.message }));
});

server.listen(port, host, () => {
  console.log(`File Sorter running at http://${host}:${port}`);
});
