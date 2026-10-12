"""Fetch CC0 photographic materials and save bounded local JPEGs."""
import io
import json
import urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'materials'
ASSETS = ['asphalt_01', 'wood_floor_deck', 'rock_boulder_cracked', 'brown_mud', 'bark_brown_02', 'forest_floor']

def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'BlueNavPlay material preparation'})
    with urllib.request.urlopen(request, timeout=40) as response:
        return response.read()

ROOT.mkdir(parents=True, exist_ok=True)
credits = []
for asset in ASSETS:
    files = json.loads(fetch(f'https://api.polyhaven.com/files/{asset}'))
    channel = next(key for key in files if key.lower() in ('diffuse', 'diff'))
    url = files[channel]['1k']['jpg']['url']
    image = Image.open(io.BytesIO(fetch(url))).convert('RGB')
    for size in (128, 512):
        image.resize((size, size), Image.Resampling.LANCZOS).save(ROOT / f'{asset}-{size}.jpg', quality=88, optimize=True)
    credits.append({'asset': asset, 'source': f'https://polyhaven.com/a/{asset}', 'download': url, 'license': 'CC0', 'licenseUrl': 'https://polyhaven.com/license'})
    print(asset, flush=True)
(ROOT / 'credits.json').write_text(json.dumps(credits, indent=2), encoding='utf-8')
