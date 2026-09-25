"""Build UI background theme assets from user-provided licensed images.

Source images stay outside Git. Outputs go to the git-ignored asset root and
the manifest records every source and output SHA-256 so a clean checkout can
verify the private assets before delivery.

Usage:
  python scripts/build-ui-background-themes.py --source-root <dir> [--write-hashes]
  python scripts/build-ui-background-themes.py --verify
"""
import argparse
import hashlib
import io
import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / 'docs' / 'project-control' / 'ui-background-themes-manifest-v1.json'


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def encode(image, quality):
    buffer = io.BytesIO()
    image.save(buffer, 'WEBP', quality=quality, method=6)
    return buffer.getvalue()


def crop_to(image, width, height, focus):
    scale = max(width / image.width, height / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    left = min(max(round(resized.width * focus['x'] - width / 2), 0), resized.width - width)
    top = min(max(round(resized.height * focus['y'] - height / 2), 0), resized.height - height)
    return resized.crop((left, top, left + width, top + height))


def build_wide(image, spec, theme):
    width, height = spec['width'], spec['height']
    # A smooth colour wash sampled from the source keeps empty space calm.
    base = image.resize((1, 5), Image.BOX).resize((width, height), Image.BICUBIC)
    base = base.filter(ImageFilter.GaussianBlur(90))
    portrait = image.copy()
    portrait.thumbnail((width, height), Image.LANCZOS)
    # Fade the portrait edge that faces the content column into the blurred wash.
    mask = Image.new('L', portrait.size, 255)
    fade = max(portrait.width // 3, 1)
    for x in range(fade):
        value = round(255 * x / fade)
        column = x if theme['portrait_side'] == 'right' else portrait.width - 1 - x
        mask.paste(value, (column, 0, column + 1, portrait.height))
    offset_x = width - portrait.width if theme['portrait_side'] == 'right' else 0
    base.paste(portrait, (offset_x, (height - portrait.height) // 2), mask)
    return base


def build(theme, source, spec):
    image = Image.open(source).convert('RGB')
    tall = image.copy()
    tall.thumbnail((spec['tall']['max_width'], spec['tall']['max_height']), Image.LANCZOS)
    thumb = crop_to(image, spec['thumb']['width'], spec['thumb']['height'], theme['focus'])
    return {
        'wide': encode(build_wide(image, spec['wide'], theme), 72),
        'tall': encode(tall, 72),
        'thumb': encode(thumb, 80),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-root')
    parser.add_argument('--write-hashes', action='store_true')
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    asset_root = ROOT / manifest['asset_root']
    failures = []
    if args.verify:
        for theme in manifest['themes']:
            for kind, output in theme.get('outputs', {}).items():
                path = asset_root / theme['id'] / manifest['outputs'][kind]['file']
                if not path.exists():
                    failures.append(f"missing:{theme['id']}/{kind}")
                elif sha256(path.read_bytes()) != output['sha256']:
                    failures.append(f"hash_mismatch:{theme['id']}/{kind}")
        print(json.dumps({'result': 'FAIL' if failures else 'PASS', 'failures': failures}))
        return 1 if failures else 0
    source_root = Path(args.source_root or os.environ.get(manifest['source_root_env'], ''))
    if not source_root.is_dir():
        print(json.dumps({'result': 'FAIL', 'error': 'source_root_missing'}))
        return 1
    for theme in manifest['themes']:
        source = source_root / theme['source']['folder'] / theme['source']['file']
        if not source.exists() or sha256(source.read_bytes()) != theme['source']['sha256']:
            failures.append(f"source_mismatch:{theme['id']}")
            continue
        outputs = build(theme, source, manifest['outputs'])
        target = asset_root / theme['id']
        target.mkdir(parents=True, exist_ok=True)
        recorded = {}
        for kind, data in outputs.items():
            (target / manifest['outputs'][kind]['file']).write_bytes(data)
            recorded[kind] = {'sha256': sha256(data), 'size': len(data)}
        if args.write_hashes:
            theme['outputs'] = recorded
        elif theme.get('outputs') != recorded:
            failures.append(f"output_hash_changed:{theme['id']}")
    if args.write_hashes and not failures:
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'result': 'FAIL' if failures else 'PASS', 'themes': len(manifest['themes']),
                      'failures': failures}))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
