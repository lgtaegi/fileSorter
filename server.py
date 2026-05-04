#!/usr/bin/env python3
# fileSorter
# Created: 2026-05-04
# Created by lgtaegi
"""Single server file to serve the UI and perform sorting."""

from flask import Flask, send_from_directory, request, jsonify
from pathlib import Path
import shutil
import logging
from collections import defaultdict
import argparse
import os

app = Flask(__name__, static_folder='.', template_folder='.')


def target_folder_for(path: Path) -> str:
    if path.is_dir():
        return None
    ext = path.suffix.lower().lstrip('.')
    return ext if ext else 'no_extension'


def size_folder_for(size: int) -> str:
    if size < 1024 * 1024:
        return 'size_under_1MB'
    if size < 100 * 1024 * 1024:
        return 'size_1MB_to_100MB'
    if size < 1024 * 1024 * 1024:
        return 'size_100MB_to_1GB'
    return 'size_over_1GB'


def folder_parts_for(path: Path, group_by):
    stat = path.stat()
    modified = stat.st_mtime
    from datetime import datetime
    date = datetime.fromtimestamp(modified)
    parts = []

    for group in group_by:
        if group == 'year':
            parts.append(str(date.year))
        elif group == 'month':
            parts.append(f'{date.month:02d}')
        elif group == 'day':
            parts.append(f'{date.day:02d}')
        elif group == 'size':
            parts.append(size_folder_for(stat.st_size))
        elif group == 'type':
            parts.append(target_folder_for(path))

    return parts or [target_folder_for(path)]


def normalize_group_by(value):
    allowed = {'year', 'month', 'day', 'size', 'type'}
    if not isinstance(value, list):
        return ['type']
    group_by = [item for item in value if item in allowed]
    return group_by or ['type']


def ensure_unique_target(dst_dir: Path, name: str) -> Path:
    candidate = dst_dir / name
    if not candidate.exists():
        return candidate
    stem = Path(name).stem
    suffix = Path(name).suffix
    i = 1
    while True:
        candidate = dst_dir / f"{stem}_{i}{suffix}"
        if not candidate.exists():
            return candidate
        i += 1


def move_or_copy(src: Path, dst_dir: Path, copy: bool = False, dry_run: bool = False):
    dst = ensure_unique_target(dst_dir, src.name)
    if dry_run:
        logging.info("DRY: %s %s -> %s", "copy" if copy else "move", src, dst)
        return
    dst_dir.mkdir(parents=True, exist_ok=True)
    if copy:
        shutil.copy2(src, dst)
        logging.info("Copied %s -> %s", src, dst)
    else:
        shutil.move(str(src), str(dst))
        logging.info("Moved %s -> %s", src, dst)


def sort_dir(source: Path, dest: Path, recursive: bool = False, copy: bool = False, dry_run: bool = False, group_by=None):
    counts = defaultdict(int)
    group_by = group_by or ['type']
    if recursive:
        iterator = source.rglob('*')
    else:
        iterator = source.iterdir()

    for p in iterator:
        if not p.is_file():
            continue
        try:
            if dest.resolve() != source.resolve() and dest.resolve().is_relative_to(source.resolve()):
                if dest.resolve() in p.resolve().parents:
                    continue
        except Exception:
            pass

        parts = folder_parts_for(p, group_by)
        if not parts:
            continue
        dst_dir = dest.joinpath(*parts)
        move_or_copy(p, dst_dir, copy=copy, dry_run=dry_run)
        counts[str(Path(*parts))] += 1

    return counts


def directory_stats(path: Path):
    files = 0
    folders = 0
    for child in path.iterdir():
        if child.is_file():
            files += 1
        elif child.is_dir():
            folders += 1
    return {'files': files, 'folders': folders}


@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


@app.route('/api/sort', methods=['POST'])
def api_sort():
    data = request.json or {}
    source = str(data.get('source') or '.').strip() or '.'
    dest = str(data.get('dest') or '').strip()
    recursive = bool(data.get('recursive'))
    copy = bool(data.get('copy'))
    dry_run = bool(data.get('dry_run'))
    group_by = normalize_group_by(data.get('group_by'))

    src = Path(source).expanduser().resolve()
    dst = Path(dest).expanduser().resolve() if dest else src

    if not src.exists() or not src.is_dir():
        return jsonify({'error': f'Source {src} is not a directory'}), 400

    counts = sort_dir(src, dst, recursive=recursive, copy=copy, dry_run=dry_run, group_by=group_by)
    counts = {k: int(v) for k, v in counts.items()}
    total = sum(counts.values())
    return jsonify({'counts': counts, 'total': total})


@app.route('/api/stats')
def api_stats():
    raw_path = (request.args.get('path') or '').strip() or os.getcwd()
    current = Path(raw_path).expanduser().resolve()

    if not current.exists() or not current.is_dir():
        return jsonify({'error': f'{current} is not a directory'}), 400

    try:
        stats = directory_stats(current)
    except PermissionError:
        return jsonify({'error': f'Permission denied: {current}'}), 403

    return jsonify({'path': str(current), 'stats': stats})


@app.route('/api/directories')
def api_directories():
    raw_path = (request.args.get('path') or '').strip() or os.getcwd()
    current = Path(raw_path).expanduser().resolve()

    if not current.exists() or not current.is_dir():
        return jsonify({'error': f'{current} is not a directory'}), 400

    dirs = []
    try:
        for child in sorted(current.iterdir(), key=lambda p: p.name.lower()):
            if child.is_dir():
                dirs.append({'name': child.name, 'path': str(child)})
    except PermissionError:
        return jsonify({'error': f'Permission denied: {current}'}), 403

    parent = current.parent if current.parent != current else None
    home = Path.home()
    roots = [
        {'name': 'Current folder', 'path': os.getcwd()},
        {'name': 'Home', 'path': str(home)},
        {'name': 'Desktop', 'path': str(home / 'Desktop')},
        {'name': 'Documents', 'path': str(home / 'Documents')},
        {'name': 'Downloads', 'path': str(home / 'Downloads')},
    ]

    return jsonify({
        'path': str(current),
        'parent': str(parent) if parent else None,
        'stats': directory_stats(current),
        'directories': dirs,
        'roots': [root for root in roots if Path(root['path']).exists()],
    })


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=5000)
    parser.add_argument('--debug', action='store_true')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    app.run(host=args.host, port=args.port, debug=args.debug)


if __name__ == '__main__':
    main()
