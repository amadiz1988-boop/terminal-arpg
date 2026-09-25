"""Build UI theme window assets from user-provided licensed images.

Source images stay outside Git. Outputs go to the git-ignored asset root and
the manifest records every source and output SHA-256 so a clean checkout can
verify the private assets before delivery.

Usage:
  python scripts/build-ui-themes.py --source-root <dir> [--write-hashes]
  python scripts/build-ui-themes.py --verify
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
MANIFEST = ROOT / 'docs' / 'project-control' / 'ui-themes-manifest-v1.json'
KINDS = ('panel', 'thumb')


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


def build_panel(image, spec, variant):
    # Soft focus, and an alpha fade on the left so the art sits on the right of
    # a window without a hard edge behind text.
    panel = frame_subject(image, spec['width'], spec['height'], variant)
    panel = panel.filter(ImageFilter.GaussianBlur(1.4)).convert('RGBA')
    mask = Image.new('L', panel.size, 255)
    fade = round(panel.width * variant.get('fade', 0.6))
    for x in range(fade):
        mask.paste(round(255 * (x / fade) ** 1.6), (x, 0, x + 1, panel.height))
    panel.putalpha(mask)
    return panel


def frame_subject(image, width, height, variant):
    # Zoom in and place the subject centre (focus) toward the right edge so
    # scenery right of the heroine is cropped and text rarely covers her.
    layout = variant.get('panel', {})
    zoom = layout.get('zoom', 1.3)
    anchor_x = layout.get('x', 0.66)
    anchor_y = layout.get('y', 0.32)
    scale = max(width / image.width, height / image.height) * zoom
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    focus = variant['focus']
    left = min(max(round(resized.width * focus['x'] - width * anchor_x), 0), resized.width - width)
    top = min(max(round(resized.height * focus['y'] - height * anchor_y), 0), resized.height - height)
    return resized.crop((left, top, left + width, top + height))


def load(source, variant):
    image = Image.open(source).convert('RGB')
    crop = variant.get('crop')
    if crop:
        image = image.crop((round(crop['left'] * image.width), round(crop['top'] * image.height),
                            round(crop['right'] * image.width), round(crop['bottom'] * image.height)))
    return image


def build(theme, variant, source, spec):
    image = load(source, variant)
    thumb = crop_to(image, spec['thumb']['width'], spec['thumb']['height'], variant['focus'])
    return {
        'panel': encode(build_panel(image, spec['panel'], variant), 74),
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
