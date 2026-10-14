#!/usr/bin/env python3
"""Build the standalone viewer with Python's standard library only."""
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'src'


def build():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inline', type=Path, help='Also write the inline HTML fragment to this path')
    args = parser.parse_args()
    fragment = (SOURCE / 'fragment.template').read_text(encoding='utf-8')
    for token, filename in (
        ('PACKED_MODEL', 'compact.json'), ('SKY_ASSET', 'sky-asset.json'),
        ('FULL_LATCH', 'full-latch-tube.json'), ('ENGINE', 'engine.js'),
        ('CONTEXT', 'context.js'), ('GPU', 'gpu.js'), ('UI', 'ui.js'),
    ):
        fragment = fragment.replace('__' + token + '__', (SOURCE / filename).read_text(encoding='utf-8'))
    if len(fragment.encode('utf-8')) >= 1_000_000:
        raise ValueError('Inline fragment exceeds the 1 MB limit')
    document = (SOURCE / 'standalone-head.html').read_text(encoding='utf-8') + fragment + '\n</main></body></html>\n'
    (ROOT / 'index.html').write_text(document, encoding='utf-8')
    if args.inline:
        args.inline.parent.mkdir(parents=True, exist_ok=True)
        args.inline.write_text(fragment, encoding='utf-8')
    print(f'Built index.html ({len(document.encode("utf-8")):,} bytes)')


if __name__ == '__main__':
    build()
