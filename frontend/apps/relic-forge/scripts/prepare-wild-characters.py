"""Cut the supplied character drawings into a base layer plus moving parts for the
character Wild columns. Pixels are never repainted: each part is an alpha-masked
copy of the original, and the base keeps a small overlap ring around each pivot so
small rotations never open a gap at the joint.

    python scripts/prepare-wild-characters.py

Coordinates below are authored on a 600 px-tall crop of each drawing.
"""
from pathlib import Path
import json, math
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'art' / 'sources'
OUT = ROOT / 'static' / 'art' / 'wild'
HEIGHT = 640
AUTHOR_H = 600

CHARACTERS = {
	'bloom-grandma': dict(src='Ռիմա2_20260607152304.png', parts=[
		dict(name='hand', anim='wave', pivot=(326, 182), overlap=14,
			poly=[(318, 150), (352, 146), (418, 160), (419, 198), (360, 202), (318, 200)]),
	]),
	'bloom-gnome': dict(src='Untitled91_0004-35-53.png', parts=[
		# Forearm, hand and pot bend at the elbow: the pivot is the rounded forearm end sitting
		# in the cuff opening. The cuff and shoulder stay still; the forearm end is kept in the
		# base ('keep') so a small rotation never opens a hole there.
		dict(name='pot', anim='lift', pivot=(122, 226),
			poly=[(28, 58), (146, 58), (146, 150), (136, 172), (140, 184), (146, 200), (147, 222), (141, 238), (122, 243), (103, 238), (98, 225), (97, 205), (84, 202), (56, 200), (30, 172)],
			keep=[(97, 212), (147, 212), (147, 222), (141, 238), (122, 243), (103, 238), (98, 225)]),
		dict(name='tool', anim='tap', pivot=(364, 256), overlap=18,
			poly=[(356, 172), (484, 172), (484, 232), (444, 308), (384, 310), (356, 290)]),
	]),
	'bloom-traveler': dict(src='Untitled90 (2).png', parts=[
		dict(name='lantern', anim='swing', pivot=(38, 52), overlap=6,
			poly=[(0, 46), (49, 46), (49, 160), (0, 160)]),
	]),
	'blight-skull': dict(src='Untitled92 (2).png', parts=[
		dict(name='stone', anim='bob', pivot=(128, 262), overlap=14,
			poly=[(36, 212), (132, 212), (138, 302), (36, 304)]),
	]),
	'blight-brute': dict(src='Untitled108 (1).png', parts=[
		dict(name='fist', anim='pump', pivot=(66, 262), overlap=12,
			poly=[(0, 218), (72, 218), (72, 302), (0, 302)]),
	]),
	'blight-keeper': dict(src='Untitled94 (1).png', parts=[
		dict(name='flail', anim='pendulum', pivot=(78, 162), overlap=8,
			poly=[(38, 164), (92, 164), (94, 196), (100, 240), (100, 312), (38, 312)]),
	]),
}


def load(name):
	im = Image.open(SOURCES / name).convert('RGBA')
	im = im.crop(im.getchannel('A').getbbox())
	return im.resize((round(im.width * HEIGHT / im.height), HEIGHT), Image.Resampling.LANCZOS)


def main():
	OUT.mkdir(parents=True, exist_ok=True)
	manifest = {}
	k = HEIGHT / AUTHOR_H
	for key, spec in CHARACTERS.items():
		im = load(spec['src'])
		w, h = im.size
		base_alpha = im.getchannel('A')
		rig = dict(width=w, height=h, parts=[])
		for part in spec['parts']:
			poly = [(x * k, y * k) for x, y in part['poly']]
			px, py = part['pivot'][0] * k, part['pivot'][1] * k
			mask = Image.new('L', im.size, 0)
			ImageDraw.Draw(mask).polygon(poly, fill=255)
			mask = mask.filter(ImageFilter.GaussianBlur(0.8))
			piece = im.copy()
			piece.putalpha(ImageChops.multiply(base_alpha, mask))
			box = piece.getchannel('A').getbbox()
			piece = piece.crop(box)
			# Remove the part from the base, except a ring around the pivot that stays as overlap.
			keep = Image.new('L', im.size, 0)
			if 'keep' in part:
				ImageDraw.Draw(keep).polygon([(x * k, y * k) for x, y in part['keep']], fill=255)
			else:
				r = part['overlap'] * k
				ImageDraw.Draw(keep).ellipse([px - r, py - r, px + r, py + r], fill=255)
			cut = ImageChops.subtract(mask, keep)
			base_alpha = ImageChops.subtract(base_alpha, cut)
			piece.save(OUT / f"{key}-{part['name']}.webp", 'WEBP', quality=90, method=6)
			rig['parts'].append(dict(
				name=part['name'], anim=part['anim'],
				left=box[0] / w * 100, top=box[1] / h * 100,
				width=(box[2] - box[0]) / w * 100, height=(box[3] - box[1]) / h * 100,
				originX=(px - box[0]) / (box[2] - box[0]) * 100, originY=(py - box[1]) / (box[3] - box[1]) * 100,
			))
		base = im.copy()
		base.putalpha(base_alpha)
		base.save(OUT / f'{key}-base.webp', 'WEBP', quality=90, method=6)
		manifest[key] = rig
		print(key, im.size, [p['name'] for p in rig['parts']])
	(ROOT / 'src' / 'petal' / 'wild-rigs.json').write_text(json.dumps(manifest, indent=1), encoding='utf-8')


if __name__ == '__main__':
	main()
