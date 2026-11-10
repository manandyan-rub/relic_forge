"""Re-export reel symbols from the preserved hand-drawn sources at reel-ready resolution.

Uses exactly the crops/contours of prepare-art.py (no repainting, no generated pixels),
but keeps up to SIZE px on the long side so symbols stay crisp on large, high-DPI reels.
Also converts the 2 MB free-spin gift PNGs to lossless-alpha WebP.

    python scripts/prepare-symbols-hd.py [--check]
"""
from pathlib import Path
import importlib.util, sys
from PIL import Image, ImageDraw, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'art' / 'sources'
TARGET = ROOT / 'static' / 'art'
SIZE = 512

spec = importlib.util.spec_from_file_location('prep', ROOT / 'scripts' / 'prepare-art.py')
prep = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prep)


def crop_alpha(im):
	if im.mode == 'RGBA' and im.getchannel('A').getbbox():
		return im.crop(im.getchannel('A').getbbox())
	return im


def region_symbol(key, name, region):
	im = Image.open(SOURCES / name)
	w, h = im.size
	if key in prep.PROP_OUTLINES:
		mask = Image.new('L', im.size)
		ImageDraw.Draw(mask).polygon([(round(x * w / 900), round(y * h / 1272)) for x, y in prep.PROP_OUTLINES[key]], fill=255)
		im.putalpha(ImageChops.multiply(im.getchannel('A'), mask))
	else:
		im = im.crop(tuple(round(v * (w if i % 2 == 0 else h)) for i, v in enumerate(region)))
	return crop_alpha(im)


def compare(key, hd):
	"""Mean absolute difference between the new export (downscaled) and the shipped file."""
	current = Image.open(TARGET / f'{key}.webp').convert('RGBA')
	small = hd.convert('RGBA').resize(current.size, Image.Resampling.LANCZOS)
	diff = ImageChops.difference(small, current)
	return sum(ImageStat.Stat(diff).mean) / 4


def main():
	check = '--check' in sys.argv
	jobs = [(k, region_symbol(k, n, r)) for k, n, r, _ in prep.REGIONS]
	for key, name in (('bloom-keeper-symbol', 'Untitled91_0004-35-53.png'), ('blight-keeper-symbol', 'Untitled94 (1).png')):
		jobs.append((key, crop_alpha(Image.open(SOURCES / name))))
	for key, im in jobs:
		im = im.copy()
		im.thumbnail((SIZE, SIZE), Image.Resampling.LANCZOS)
		score = compare(key, im)
		print(f'{key:24} {im.size}  drift={score:.2f}')
		# Small sources (e.g. the brooch) re-encode at the same size, so allow lossy drift there.
		if score > (14 if im.size == Image.open(TARGET / f'{key}.webp').size else 12):
			raise SystemExit(f'{key}: crop drifted from the shipped asset; refusing to overwrite')
		if not check:
			im.save(TARGET / f'{key}.webp', 'WEBP', quality=90, method=6)
	for world in ('bloom', 'blight'):
		src = SOURCES / f'{world}-free-spins-gift.png'
		if src.exists() and not check:
			im = Image.open(src)
			im.thumbnail((900, 900), Image.Resampling.LANCZOS)
			im.save(TARGET / f'{world}-free-spins-gift.webp', 'WEBP', quality=90, method=6)
			print(f'{world}-free-spins-gift.webp', (TARGET / f'{world}-free-spins-gift.webp').stat().st_size // 1024, 'KB')


if __name__ == '__main__':
	main()
