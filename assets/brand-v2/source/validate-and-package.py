"""Validate brand deliverables and package them; no application code is generated."""
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from zipfile import ZipFile, ZIP_DEFLATED

from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'manifest.json').read_text())
checks = []

for asset in manifest['assets']:
    file = root / asset['file']
    with Image.open(file) as im:
        assert im.mode == 'RGBA', file
        assert im.size == (asset['width'], asset['height']), file
        alpha = im.getchannel('A')
        assert alpha.getextrema() == (0, 255), file
        left, top, right, bottom = alpha.getbbox()
        assert left > 0 and top > 0 and right < im.width and bottom < im.height, file
    checks.append({'file': asset['file'], 'bytes': file.stat().st_size,
                   'sha256': hashlib.sha256(file.read_bytes()).hexdigest(),
                   'rgba': True, 'transparent_background': True, 'unclipped': True})

for file in sorted((root / 'svg').glob('*.svg')):
    source = file.read_text()
    document = ET.fromstring(source)
    assert document.attrib.get('viewBox'), file
    assert 'cobranzapp' in source, file
    assert not any(needle in source for needle in ['<image', '<text', 'href=', 'data:']), file
    checks.append({'file': str(file.relative_to(root)), 'bytes': file.stat().st_size,
                   'sha256': hashlib.sha256(file.read_bytes()).hexdigest(),
                   'vector_only': True, 'font_independent': True})

with Image.open(root / 'png/cobranzapp-isotype-primary-256.png') as im:
    im.save(root / 'cobranzapp-favicon.ico', sizes=[(s, s) for s in [16, 24, 32, 48, 64, 128, 256]])
with Image.open(root / 'cobranzapp-favicon.ico') as ico:
    assert ico.ico.sizes() == {(s, s) for s in [16, 24, 32, 48, 64, 128, 256]}
    for size in ico.ico.sizes():
        assert ico.ico.getimage(size).getchannel('A').getextrema() == (0, 255)

# Actual-size visual proof. This presentation surface is not a production logo.
board = Image.new('RGB', (720, 180), '#FFEDD5')
for left, size in zip([24, 94, 174, 274, 414], [24, 32, 48, 64, 128]):
    with Image.open(root / f'png/cobranzapp-isotype-primary-{size}.png') as im:
        board.paste(im, (left, 16), im)
    ImageDraw.Draw(board).text((left, 152), f'{size}px', fill='#171717')
board.save(root / 'previews/cobranzapp-small-size-check.png')

(root / 'validation.json').write_text(json.dumps({
    'brand': 'cobranzapp', 'png_count': len(manifest['assets']), 'svg_count': 12,
    'favicon_transparent': True, 'checks': checks,
    'limitations': ['Automated geometry/alpha validation, not native-app integration tests.',
                    'Trademark clearance pending; v2 artwork approved by the user.'],
}, indent=2) + '\n')

archive = root / 'cobranzapp-brand-kit-v2.zip'
with ZipFile(archive, 'w', compression=ZIP_DEFLATED, compresslevel=9) as bundle:
    for file in sorted(root.rglob('*')):
        if file.is_file() and file != archive:
            bundle.write(file, Path('cobranzapp-brand-kit-v2') / file.relative_to(root))
with ZipFile(archive) as bundle:
    assert bundle.testzip() is None
print(f'Validated {len(manifest["assets"])} transparent PNGs, 12 vector SVGs and 7 favicon sizes.')
print(f'Packaged {archive} ({archive.stat().st_size:,} bytes).')
