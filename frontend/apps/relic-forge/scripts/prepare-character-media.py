"""Prepare supplied character clips without erasing dark clothing or ghosting.

Requires ffmpeg, Pillow, NumPy and SciPy. Original RGB source clips are untouched.
Preserves semantic soft edges, repairs opaque character interiors, and rebuilds
Bloom's loop from clean RGB poses instead of repeatedly blending its old edit.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
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
    ('bloom-traveler-spin', '2026-10-15_21-18-08_Lumina_1.mp4', 6, 2000, 1.0, .5, 1.0),
    ('blight-keeper-spin', '2026-10-15_21-29-23_Lumina_1.mp4', 3, 64, 0.0, .5, 2.0),
    ('bloom-traveler-big', '2026-10-15_21-23-21_Lumina_1.mp4', 6, 2000, 0.0, 5.0, None),
    ('blight-keeper-big', '2026-10-15_21-29-23_Lumina_1.mp4', 3, 64, 0.0, 5.0, None),
]


def matte(rgb, threshold, hole_limit, support):
    foreground = ndimage.binary_closing(
        (rgb.max(axis=2) > threshold) & ndimage.binary_dilation(support > 32, iterations=10),
        structure=np.ones((3, 3), dtype=bool))
    labels, _ = ndimage.label(foreground)
    areas = np.bincount(labels.ravel())
    areas[0] = 0
    # Keep disconnected lanterns/flails, but discard compression specks.
    keep = areas >= 120
    keep[np.argmax(areas)] = True
    foreground = keep[labels]
    holes = ndimage.binary_fill_holes(foreground) & ~foreground
    labels, _ = ndimage.label(holes)
    areas = np.bincount(labels.ravel())
    support_sum = np.bincount(labels.ravel(), weights=support.ravel(), minlength=len(areas))
    support_mean = np.divide(support_sum, areas, out=np.zeros_like(support_sum), where=areas > 0)
    foreground |= (labels > 0) & (areas[labels] <= hole_limit) & (support_mean[labels] > 128)
    alpha = np.asarray(Image.fromarray(np.uint8(foreground) * 255).filter(
        ImageFilter.GaussianBlur(.45)), dtype=np.float32) / 255
    # RGB was supplied against black; remove that black from softened edges.
    color = np.divide(rgb.astype(np.float32), alpha[:, :, None],
                      out=np.zeros_like(rgb, dtype=np.float32), where=alpha[:, :, None] > .01)
    rgba = np.dstack((np.clip(color, 0, 255).astype(np.uint8), np.uint8(np.round(alpha * 255))))
    return Image.fromarray(rgba, 'RGBA')


def harden(rgb, prepared):
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
    args = parser.parse_args()
    args.scratch.mkdir(parents=True, exist_ok=True)
    cache = {}
    manifest = {}
    for name, source, threshold, hole_limit, start, duration, cycle in JOBS:
        work = args.scratch / name
        work.mkdir(exist_ok=True)
        if source not in cache:
            cache[source] = decode(SOURCES / source)
        original = cache[source]
        first = round(start * 24)
        available = max(1, round(duration * 24))
        semantic_source = ('bloom-spin-input.mkv' if name == 'bloom-traveler-spin' else
                           'blight-spin-input.mkv' if name == 'blight-keeper-spin' else
                           'bloom-big-alpha-input.webm' if name.startswith('bloom') else 'blight-big-alpha-input.webm')
        semantic = decode(SOURCES / semantic_source, alpha=True)
        if name == 'bloom-traveler-spin':
            # The legacy short input was already blended. Use only its semantic
            # support; original RGB supplies every visible pose without doubles.
            source_frames = []
            for rgb in original[first:first + available]:
                scores = []
                for prepared in semantic:
                    opaque = prepared[:, :, 3] > 230
                    scores.append(np.abs(rgb[opaque].astype(np.float32) - prepared[:, :, :3][opaque]).mean())
                support = semantic[int(np.argmin(scores)), :, :, 3]
                source_frames.append(matte(rgb, 6, hole_limit, support))
        else:
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
        for index, frame in enumerate(frames):
            frame.save(work / f'frame-{index:03d}.png')
        room = Image.open(ROOT / 'static' / 'art' / ('bloom-room.webp' if name.startswith('bloom') else 'blight-room.webp'))
        sampled = sorted(set([0, len(frames) // 4, len(frames) // 2, 3 * len(frames) // 4, len(frames) - 1]))
        contact(frames, sampled, args.scratch / f'{name}-after-contact.jpg', room)
        meta = dict(source=f'art/sources/{source}', sourceSha256=hashlib.sha256((SOURCES / source).read_bytes()).hexdigest(),
                    semanticSource=f'art/sources/{semantic_source}', semanticSourceSha256=hashlib.sha256((SOURCES / semantic_source).read_bytes()).hexdigest(),
                    sourceStartSeconds=start, sourceEndSeconds=start + duration, sourceFps=24,
                    sourceKind='supplied-original-rgb-clip', edit='semantic alpha support; original RGB poses; nearest frames; cosine-paced forward/return' if cycle else 'preserved semantic alpha; eroded interior hardening; original RGB and frame order',
                    matteThreshold=6 if name == 'bloom-traveler-spin' else None, filledHoleMaximumPixels=hole_limit if name == 'bloom-traveler-spin' else 0, minimumComponentPixels=120,
                    opaqueInteriorAlphaThreshold=64, opaqueInteriorErosionPixels=2,
                    crop=list(crop), dimensions=list(frames[0].size), durationSeconds=len(frames) / fps,
                    frames=len(frames), fps=fps, sourceFrameIndices=[first + i for i in indices])
        if not args.preview_only:
            output = ROOT / 'static' / 'art' / f'{name}.webm'
            subprocess.run([
                'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(fps),
                '-i', str(work / 'frame-%03d.png'), '-frames:v', str(len(frames)), '-an',
                '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-b:v', '0',
                '-crf', '25', '-deadline', 'good', '-cpu-used', '3', '-metadata:s:v:0', 'alpha_mode=1', str(output)], check=True)
            frames[0].save(ROOT / 'static' / 'art' / f'{name}-poster.webp', 'WEBP', quality=92, method=6)
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
