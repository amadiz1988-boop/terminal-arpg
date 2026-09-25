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
KINDS = ('wide', 'tall', 'thumb')


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


def build_wide(image, spec, variant, side):
    width, height = spec['width'], spec['height']
    if image.width / image.height >= 1.2:
        # Landscape sources already fit the desktop frame.
        return crop_to(image, width, height, variant['focus'])
    # A smooth colour wash sampled from the source keeps empty space calm.
    base = image.resize((1, 5), Image.BOX).resize((width, height), Image.BICUBIC)
    base = base.filter(ImageFilter.GaussianBlur(90))
    portrait = image.copy()
    portrait.thumbnail((width, height), Image.LANCZOS)
    # Fade the portrait edge that faces the content column into the wash.
    mask = Image.new('L', portrait.size, 255)
    fade = max(portrait.width // 3, 1)
    for x in range(fade):
        column = x if side == 'right' else portrait.width - 1 - x
        mask.paste(round(255 * x / fade), (column, 0, column + 1, portrait.height))
    offset_x = width - portrait.width if side == 'right' else 0
    base.paste(portrait, (offset_x, (height - portrait.height) // 2), mask)
    return base


def load(source, variant):
    image = Image.open(source).convert('RGB')
    crop = variant.get('crop')
    if crop:
        image = image.crop((round(crop['left'] * image.width), round(crop['top'] * image.height),
                            round(crop['right'] * image.width), round(crop['bottom'] * image.height)))
    return image


def build(theme, variant, source, spec):
    image = load(source, variant)
    tall = crop_to(image, spec['tall']['width'], spec['tall']['height'], variant['focus'])
    thumb = crop_to(image, spec['thumb']['width'], spec['thumb']['height'], variant['focus'])
    return {
        'wide': encode(build_wide(image, spec['wide'], variant, theme['portrait_side']), 72),
        'tall': encode(tall, 72),
        'thumb': encode(thumb, 80),
    }


def variant_dir(asset_root, theme, variant):
    return asset_root / theme['id'] / variant['key']


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-root')
    parser.add_argument('--write-hashes', action='store_true')
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    asset_root = ROOT / manifest['asset_root']
    failures = []
    variants = [(theme, variant) for theme in manifest['themes'] for variant in theme['variants']]
    if args.verify:
        for theme, variant in variants:
            for kind in KINDS:
                path = variant_dir(asset_root, theme, variant) / manifest['outputs'][kind]['file']
                expected = variant.get('outputs', {}).get(kind, {}).get('sha256')
                if not path.exists():
                    failures.append(f"missing:{variant['key']}/{kind}")
                elif sha256(path.read_bytes()) != expected:
                    failures.append(f"hash_mismatch:{variant['key']}/{kind}")
        print(json.dumps({'result': 'FAIL' if failures else 'PASS', 'variants': len(variants),
                          'failures': failures}))
        return 1 if failures else 0
    source_root = Path(args.source_root or os.environ.get(manifest['source_root_env'], ''))
    if not source_root.is_dir():
        print(json.dumps({'result': 'FAIL', 'error': 'source_root_missing'}))
        return 1
    for theme, variant in variants:
        source = source_root / variant['source']['folder'] / variant['source']['file']
        if not source.exists() or sha256(source.read_bytes()) != variant['source']['sha256']:
            failures.append(f"source_mismatch:{variant['key']}")
            continue
        outputs = build(theme, variant, source, manifest['outputs'])
        target = variant_dir(asset_root, theme, variant)
        target.mkdir(parents=True, exist_ok=True)
        recorded = {}
        for kind in KINDS:
            (target / manifest['outputs'][kind]['file']).write_bytes(outputs[kind])
            recorded[kind] = {'sha256': sha256(outputs[kind]), 'size': len(outputs[kind])}
        if args.write_hashes:
            variant['outputs'] = recorded
        elif variant.get('outputs') != recorded:
            failures.append(f"output_hash_changed:{variant['key']}")
    if args.write_hashes and not failures:
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'result': 'FAIL' if failures else 'PASS', 'variants': len(variants),
                      'failures': failures}))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
