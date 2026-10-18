"""Prepare supplied character clips and the corrected Bloom PNG sequence.

Requires ffmpeg, Pillow and NumPy; original clip processing also needs SciPy.
Original RGB source clips are untouched.
The corrected Bloom spin uses all sixty supplied RGBA frames without edits.
Other clips preserve semantic soft edges and repair opaque character interiors.
"""
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw
import argparse
import hashlib
import json
import math
import subprocess
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'art' / 'sources'
SIZE = (624, 832)
JOBS = [
    ('bloom-traveler-spin', 'bloom-corrected-spin', 0.0, 1.0, 1.0),
    ('blight-keeper-spin', '2026-10-15_21-29-23_Lumina_1.mp4', 0.0, .5, 2.0),
    ('bloom-traveler-big', '2026-10-15_21-23-21_Lumina_1.mp4', 0.0, 5.0, None),
    ('blight-keeper-big', '2026-10-15_21-29-23_Lumina_1.mp4', 0.0, 5.0, None),
]


def corrected_bloom_frames(source):
    filenames = [f'frame_{index:04d}.png' for index in range(1, 61)]
    paths = {path.name: path for path in source.glob('*.png') if path.is_file()}
    if set(paths) != set(filenames):
        raise ValueError('Corrected Bloom spin requires exactly frame_0001.png through frame_0060.png')
    frames, provenance = [], []
    dimensions = None
    for filename in filenames:
        payload = paths[filename].read_bytes()
        with Image.open(BytesIO(payload)) as image:
            if image.format != 'PNG' or image.mode != 'RGBA':
                raise ValueError(f'{filename} must be an RGBA PNG')
            if any(size % 2 for size in image.size):
                raise ValueError(f'{filename} must have even dimensions for VP9')
            if dimensions is not None and image.size != dimensions:
                raise ValueError(f'{filename} has inconsistent corrected Bloom dimensions')
            dimensions = image.size
            frames.append(image.copy())
        provenance.append(dict(filename=filename, sha256=hashlib.sha256(payload).hexdigest()))
    return frames, provenance


def harden(rgb, prepared):
    from scipy import ndimage

    alpha = prepared[:, :, 3]
    interior = ndimage.binary_erosion(alpha > 64, iterations=2)
    rgba = prepared.copy()
    # Keep the existing decontaminated soft edge and its RGB intact.
    rgba[interior, :3] = rgb[interior]
    rgba[interior, 3] = 255
    return Image.fromarray(rgba, 'RGBA')


def decode(path, alpha=False):
    command = ['ffmpeg', '-hide_banner', '-loglevel', 'error']
    if alpha and path.suffix == '.webm':
        command += ['-c:v', 'libvpx-vp9']
    command += ['-i', str(path), '-an', '-vf', 'scale=624:832', '-f', 'rawvideo',
                '-pix_fmt', 'rgba' if alpha else 'rgb24', '-']
    raw = subprocess.run(command, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape((-1, SIZE[1], SIZE[0], 4 if alpha else 3))


def contact(frames, indices, path, room):
    width, height = 240, 320
    sheet = Image.new('RGB', (len(indices) * width, 2 * height + 26), '#202020')
    draw = ImageDraw.Draw(sheet)
    for column, index in enumerate(indices):
        frame = frames[index]
        for row in range(2):
            background = Image.new('RGBA', frame.size, '#dbb85c') if row == 0 else room.resize(frame.size).convert('RGBA')
            background.alpha_composite(frame)
            background.thumbnail((width, height))
            sheet.paste(background.convert('RGB'), (column * width, 26 + row * height))
        draw.text((column * width + 5, 5), f'frame {index}', fill='white')
    sheet.save(path, quality=92)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--scratch', type=Path, required=True)
    parser.add_argument('--preview-only', action='store_true')
    parser.add_argument('--only', choices=[job[0] for job in JOBS])
    args = parser.parse_args()
    args.scratch.mkdir(parents=True, exist_ok=True)
    cache = {}
    manifest_path = ROOT / 'art' / 'character-media.json'
    manifest = json.loads(manifest_path.read_text()) if args.only and manifest_path.exists() else {}
    for name, source, start, duration, cycle in JOBS:
        if args.only and name != args.only:
            continue
        work = args.scratch / name
        work.mkdir(exist_ok=True)
        corrected = name == 'bloom-traveler-spin'
        if corrected:
            frames, source_files = corrected_bloom_frames(SOURCES / source)
            fps, first, indices, crop = 60, 0, list(range(60)), (0, 0, *frames[0].size)
            meta = dict(source=f'art/sources/{source}', sourceFiles=source_files,
                        sourceStartSeconds=0.0, sourceEndSeconds=1.0, sourceFps=60,
                        sourceKind='user-corrected-rgba-png-sequence',
                        edit='supplied PNGs in original order; unchanged RGBA pixel canvas; no matte, crop, blending or retiming')
        else:
            if source not in cache:
                cache[source] = decode(SOURCES / source)
            original = cache[source]
            first = round(start * 24)
            available = max(1, round(duration * 24))
            semantic_source = ('blight-spin-input.mkv' if name == 'blight-keeper-spin' else
                               'bloom-big-alpha-input.webm' if name.startswith('bloom') else 'blight-big-alpha-input.webm')
            semantic = decode(SOURCES / semantic_source, alpha=True)
            source_frames = [harden(rgb, prepared) for rgb, prepared in
                             zip(original[first:first + available], semantic)]
            if cycle:
                fps, count = 60, round(cycle * 60)
                indices = [round((len(source_frames) - 1) * (1 - math.cos(2 * math.pi * i / count)) / 2) for i in range(count)]
                frames = [source_frames[i] for i in indices]
                union = np.zeros((SIZE[1], SIZE[0]), dtype=bool)
                for image in source_frames:
                    union |= np.array(image)[:, :, 3] > 8
                ys, xs = np.where(union)
                left = max(0, int(xs.min()) - 2) // 2 * 2
                top = max(0, int(ys.min()) - 2) // 2 * 2
                right = min(SIZE[0], (int(xs.max()) + 4) // 2 * 2)
                bottom = min(SIZE[1], (int(ys.max()) + 4) // 2 * 2)
                crop = (left, top, right, bottom)
                frames = [frame.crop(crop) for frame in frames]
            else:
                fps, frames, indices, crop = 24, source_frames, list(range(len(source_frames))), (0, 0, *SIZE)
            meta = dict(source=f'art/sources/{source}', sourceSha256=hashlib.sha256((SOURCES / source).read_bytes()).hexdigest(),
                        semanticSource=f'art/sources/{semantic_source}', semanticSourceSha256=hashlib.sha256((SOURCES / semantic_source).read_bytes()).hexdigest(),
                        sourceStartSeconds=start, sourceEndSeconds=start + duration, sourceFps=24,
                        sourceKind='supplied-original-rgb-clip', edit='semantic alpha support; original RGB poses; nearest frames; cosine-paced forward/return' if cycle else 'preserved semantic alpha; eroded interior hardening; original RGB and frame order',
                        matteThreshold=None, filledHoleMaximumPixels=0, minimumComponentPixels=120,
                        opaqueInteriorAlphaThreshold=64, opaqueInteriorErosionPixels=2)
        for index, frame in enumerate(frames):
            frame.save(work / f'frame-{index:03d}.png')
        room = Image.open(ROOT / 'static' / 'art' / ('bloom-room.webp' if name.startswith('bloom') else 'blight-room.webp'))
        sampled = sorted(set([0, len(frames) // 4, len(frames) // 2, 3 * len(frames) // 4, len(frames) - 1]))
        contact(frames, sampled, args.scratch / f'{name}-after-contact.jpg', room)
        meta.update(crop=list(crop), dimensions=list(frames[0].size), durationSeconds=len(frames) / fps,
                    frames=len(frames), fps=fps, sourceFrameIndices=[first + i for i in indices])
        if not args.preview_only:
            output = ROOT / 'static' / 'art' / f'{name}.webm'
            quality = ['-lossless', '1'] if corrected else ['-crf', '25']
            # Convert color separately: swscale's RGBA-to-YUVA path rounds
            # alpha values 128..254 upward. Reattach the untouched alpha plane.
            alpha_filter = [
                '-filter_complex', '[0:v]split[color][alpha];[alpha]alphaextract[a];'
                '[color]format=yuv420p[c];[c][a]alphamerge[out]', '-map', '[out]',
            ] if corrected else []
            subprocess.run([
                'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(fps),
                '-i', str(work / 'frame-%03d.png'), *alpha_filter, '-frames:v', str(len(frames)), '-an',
                '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-b:v', '0',
                *quality, '-deadline', 'good', '-cpu-used', '3', '-metadata:s:v:0', 'alpha_mode=1', str(output)], check=True)
            poster_options = dict(lossless=True, exact=True, method=6) if corrected else dict(quality=92, method=6)
            frames[0].save(ROOT / 'static' / 'art' / f'{name}-poster.webp', 'WEBP', **poster_options)
            meta['sha256'] = hashlib.sha256(output.read_bytes()).hexdigest()
            if cycle:
                (ROOT / 'art' / f'{name}-loop.json').write_text(json.dumps(meta, indent=2), encoding='utf-8')
        manifest[name] = meta
        print(name, meta['dimensions'], meta['crop'], flush=True)
    (args.scratch / 'character-media.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    if not args.preview_only:
        (ROOT / 'art' / 'character-media.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
