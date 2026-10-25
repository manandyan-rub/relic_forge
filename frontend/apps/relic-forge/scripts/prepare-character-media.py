"""Prepare character clips and the supplied cleaned PNG sequences.

Requires ffmpeg, Pillow and NumPy; original clip processing also needs SciPy.
Original RGB source clips are untouched.
The corrected Bloom spin preserves its sixty supplied frames, RGB and canvas;
only tiny detached alpha specks in two fixed exterior regions are removed.
Other clips preserve semantic soft edges and repair opaque character interiors.
The Blight spin attenuates isolated weak dark floor haze, restores its lower
cloak from a preserved reference frame, and gently antialiases alpha edges.
The supplied Blight final-win frames retain their RGB and alpha, with one
shared crop of transparent margins, in their original order at 24 fps.
"""
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
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
    ('blight-keeper-big', 'blight-cleaned', 0.0, 5.0, None),
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


def cleaned_blight_frames(source):
    sequence_path = source / 'sequence.json'
    sequence = json.loads(sequence_path.read_text(encoding='utf-8'))
    if sequence['frameCount'] != 120 or sequence['fps'] != 24:
        raise ValueError('Cleaned Blight requires 120 supplied frames at 24 fps')
    filenames = [sequence['filenamePattern'].format(index=index) for index in range(1, 121)]
    paths = {path.name: path for path in source.glob('*.png') if path.is_file()}
    if set(paths) != set(filenames):
        raise ValueError('Cleaned Blight requires exactly monster.jpg0001.png through monster.jpg0120.png')
    provenance, boxes = [], []
    dimensions = tuple(sequence['sourceCanvas'])
    for filename in filenames:
        payload = paths[filename].read_bytes()
        with Image.open(BytesIO(payload)) as frame:
            if frame.format != 'PNG' or frame.mode != 'RGBA' or frame.size != dimensions:
                raise ValueError(f'{filename} must be an RGBA PNG on the supplied canvas')
            bounds = frame.getchannel('A').getbbox()
            if bounds is None:
                raise ValueError(f'{filename} has no visible character artwork')
            boxes.append(bounds)
        provenance.append(dict(filename=filename, sha256=hashlib.sha256(payload).hexdigest()))
    margin = sequence['transparentMarginPixels']
    left = max(0, min(box[0] for box in boxes) - margin) // 2 * 2
    top = max(0, min(box[1] for box in boxes) - margin) // 2 * 2
    right = min(dimensions[0], (max(box[2] for box in boxes) + margin + 1) // 2 * 2)
    bottom = min(dimensions[1], (max(box[3] for box in boxes) + margin + 1) // 2 * 2)
    crop = (left, top, right, bottom)
    frames = []
    for filename in filenames:
        with Image.open(paths[filename]) as frame:
            frames.append(frame.crop(crop))
    return frames, provenance, sequence, crop


def cleanup_bloom_specks(frames):
    regions = [
        dict(name='shoulder', bounds=[416, 272, 456, 336], maximumComponentPixels=32,
             minimumDistancePixels=0),
        dict(name='floor', bounds=[320, 732, 352, 748], maximumComponentPixels=32,
             minimumDistancePixels=6),
    ]
    for region in regions:
        region.update(removedComponentsByFrame=[], removedPixelsByFrame=[])
    cleanup = dict(
        method='clear alpha only for small 8-connected alpha>0 components wholly inside fixed ROIs; protect ROI boundaries, larger components and the floor region minimum distance to foreground',
        connectivity=8, alphaThreshold=0, distanceMetric='Euclidean pixel centers',
        distanceWindowRadius=8, maximumComponentPixels=32, regions=regions,
        removedComponentsByFrame=[], removedPixelsByFrame=[])
    cleaned = []
    for image in frames:
        if image.mode != 'RGBA' or image.size != (512, 748):
            raise ValueError('Bloom speck cleanup requires the corrected 512x748 RGBA canvas')
        rgba = np.asarray(image)
        alpha = rgba[:, :, 3].copy()
        foreground = alpha > 0
        frame_components = frame_pixels = 0
        for region in regions:
            left, top, right, bottom = region['bounds']
            active = foreground[top:bottom, left:right]
            height, width = active.shape
            visited = np.zeros(active.shape, dtype=bool)
            removed_components = removed_pixels = 0
            for row, column in zip(*np.nonzero(active)):
                if visited[row, column]:
                    continue
                visited[row, column] = True
                stack, component = [(int(row), int(column))], []
                boundary = False
                while stack:
                    y, x = stack.pop()
                    component.append((y, x))
                    boundary |= y == 0 or x == 0 or y == height - 1 or x == width - 1
                    for next_y in range(max(0, y - 1), min(height, y + 2)):
                        for next_x in range(max(0, x - 1), min(width, x + 2)):
                            if active[next_y, next_x] and not visited[next_y, next_x]:
                                visited[next_y, next_x] = True
                                stack.append((next_y, next_x))
                if boundary or len(component) > region['maximumComponentPixels']:
                    continue
                ys, xs = np.asarray(component).T
                ys, xs = ys + top, xs + left
                window_left, window_top = max(0, int(xs.min()) - 8), max(0, int(ys.min()) - 8)
                window_right = min(image.width, int(xs.max()) + 9)
                window_bottom = min(image.height, int(ys.max()) + 9)
                nearby = foreground[window_top:window_bottom, window_left:window_right].copy()
                nearby[ys - window_top, xs - window_left] = False
                other_ys, other_xs = np.nonzero(nearby)
                if len(other_ys):
                    distances = ((other_ys[:, None] + window_top - ys) ** 2 +
                                 (other_xs[:, None] + window_left - xs) ** 2)
                    if np.any(distances < region['minimumDistancePixels'] ** 2):
                        continue
                alpha[ys, xs] = 0
                removed_components += 1
                removed_pixels += len(component)
            region['removedComponentsByFrame'].append(removed_components)
            region['removedPixelsByFrame'].append(removed_pixels)
            frame_components += removed_components
            frame_pixels += removed_pixels
        if frame_pixels:
            image = image.copy()
            image.putalpha(Image.fromarray(alpha))
        cleaned.append(image)
        cleanup['removedComponentsByFrame'].append(frame_components)
        cleanup['removedPixelsByFrame'].append(frame_pixels)
    return cleaned, cleanup


def cleanup_blight_floor(frames):
    from scipy import ndimage

    size = (458, 820)
    left, top, right, bottom = (0, 752, 458, 820)
    feather = 12
    y_weight = np.clip((np.arange(size[1]) - top) / feather, 0, 1)
    strength = np.broadcast_to(y_weight[:, None], (size[1], size[0]))
    roi = np.zeros((size[1], size[0]), dtype=bool)
    roi[top:bottom, left:right] = True
    cleanup = dict(
        method='alpha-only feathered removal of weak dark floor haze isolated from opaque foreground; preserve RGB, opaque body/robe and pixels outside the fixed floor ROI',
        region=[left, top, right, bottom], maximumAlpha=64, maximumRgb=12,
        opaqueForegroundMinimumAlpha=128, minimumDistancePixels=4,
        distanceMetric='Euclidean pixel centers from original alpha>=128 foreground',
        featherPixels=feather, featherAxes=['y'],
        featherMethod='linear y onset from zero strength at ROI boundary to full strength after 12 pixels',
        diagnosticScope='every output frame; before/after alpha within the fixed ROI',
        before=dict(nonzeroPixelsByFrame=[], alphaSumByFrame=[]),
        after=dict(nonzeroPixelsByFrame=[], alphaSumByFrame=[]),
        eligiblePixelsByFrame=[], clearedPixelsByFrame=[], attenuatedPixelsByFrame=[])
    cleaned = []
    for image in frames:
        if image.mode != 'RGBA' or image.size != size:
            raise ValueError(f'Blight floor cleanup requires an RGBA {size[0]}x{size[1]} canvas')
        rgba = np.asarray(image)
        alpha = rgba[:, :, 3]
        opaque = alpha >= 128
        distance = ndimage.distance_transform_edt(~opaque) if opaque.any() else np.full(alpha.shape, np.inf)
        eligible = roi & (alpha > 0) & (alpha <= 64) & (rgba[:, :, :3].max(axis=2) <= 12) & (distance >= 4)
        changed_alpha = alpha.copy()
        changed_alpha[eligible] = np.rint(alpha[eligible] * (1 - strength[eligible])).astype(np.uint8)
        cleared = int(np.count_nonzero((alpha > 0) & (changed_alpha == 0)))
        attenuated = int(np.count_nonzero((changed_alpha > 0) & (changed_alpha < alpha)))
        cleanup['before']['nonzeroPixelsByFrame'].append(int(np.count_nonzero(alpha[roi])))
        cleanup['before']['alphaSumByFrame'].append(int(alpha[roi].sum()))
        cleanup['after']['nonzeroPixelsByFrame'].append(int(np.count_nonzero(changed_alpha[roi])))
        cleanup['after']['alphaSumByFrame'].append(int(changed_alpha[roi].sum()))
        cleanup['eligiblePixelsByFrame'].append(int(np.count_nonzero(eligible)))
        cleanup['clearedPixelsByFrame'].append(cleared)
        cleanup['attenuatedPixelsByFrame'].append(attenuated)
        if cleared or attenuated:
            image = image.copy()
            image.putalpha(Image.fromarray(changed_alpha))
        cleaned.append(image)
    cleanup['totals'] = dict(
        clearedPixels=sum(cleanup['clearedPixelsByFrame']),
        attenuatedPixels=sum(cleanup['attenuatedPixelsByFrame']),
        removedAlpha=sum(cleanup['before']['alphaSumByFrame']) - sum(cleanup['after']['alphaSumByFrame']))
    return cleaned, cleanup


def repair_blight_cloak(frames):
    from scipy import ndimage

    reference_path = SOURCES / 'blight-cloak-reference.png'
    reference = Image.open(reference_path).convert('RGBA')
    if reference.size != (458, 820):
        raise ValueError('Blight cloak reference requires the native 458x820 RGBA canvas')
    # Follow the inner leg/hem and the back panel behind the hanging arm.
    # Each moving frame remains above the fabric, preserving its foreground.
    polygon = [(196, 500), (315, 500), (332, 545), (349, 612), (364, 700),
               (364, 810), (96, 810), (96, 781), (135, 764), (172, 744),
               (193, 721), (201, 692), (190, 640), (177, 595), (171, 550)]
    back_polygon = [(327, 265), (372, 265), (380, 276), (391, 300), (394, 325),
                    (396, 350), (394, 375), (416, 400), (412, 425), (401, 450),
                    (389, 465), (373, 480), (352, 468), (345, 435), (338, 390), (330, 330)]
    masks = []
    for contour, feather in ((polygon, .8), (back_polygon, .65)):
        mask = Image.new('L', (reference.width * 4, reference.height * 4))
        ImageDraw.Draw(mask).polygon([(x * 4, y * 4) for x, y in contour], fill=255)
        masks.append(np.array(mask.resize(reference.size, Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(feather))))
    mask = np.maximum(*masks)
    patch = np.array(reference)
    patch[:, :, 3] = np.rint(patch[:, :, 3].astype(float) * mask / 255).astype(np.uint8)
    patch_active = patch[:, :, 3] > 0
    underlay = Image.fromarray(patch)
    # Frame 32 retains the exterior flap beside the bent leg/right foot.
    # Retain its ragged outline without copying faint exterior haze or skin.
    foot_reference_path = SOURCES / 'blight-foot-cloak-reference.png'
    foot_reference = Image.open(foot_reference_path).convert('RGBA')
    if foot_reference.size != reference.size:
        raise ValueError('Blight foot cloak reference requires the native 458x820 RGBA canvas')
    foot_polygon = [(142, 568), (148, 575), (151, 590), (153, 600), (158, 620),
                    (160, 634), (160, 650), (162, 665), (160, 680), (155, 690),
                    (151, 700), (143, 715), (127, 730), (108, 740), (86, 744), (80, 744), (82, 724),
                    (92, 700), (108, 675), (119, 650), (126, 625), (131, 600), (136, 577)]
    foot_mask = Image.new('L', (reference.width * 4, reference.height * 4))
    ImageDraw.Draw(foot_mask).polygon([(x * 4, y * 4) for x, y in foot_polygon], fill=255)
    foot_mask = np.array(foot_mask.resize(reference.size, Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(.5)))
    foot_patch = np.array(foot_reference)
    foot_alpha = np.rint((foot_patch[:, :, 3].astype(float) - 64) * 255 / 128).clip(0, 255)
    foot_patch[:, :, 3] = np.rint(foot_alpha * foot_mask / 255).astype(np.uint8)
    foot_active = foot_patch[:, :, 3] > 0
    underlay = Image.alpha_composite(Image.fromarray(foot_patch), underlay)
    patch_active |= foot_active
    # Protect the thin chain/flail, the moving grip, face and finger details.
    protected_regions = [[0, 120, 185, 470], [220, 105, 335, 185], [376, 430, 449, 576]]
    protected = np.zeros((820, 458), dtype=bool)
    for left, top, right, bottom in protected_regions:
        protected[top:bottom, left:right] = True
    meta = dict(
        reference=f'art/sources/{reference_path.name}',
        referenceSha256=hashlib.sha256(reference_path.read_bytes()).hexdigest(),
        referenceOutputFrame=31, referenceOriginalSourceFrame=5,
        referenceRuntimeSha256='fa6f54ac874baf8598a36ecf3303df5f128759ccffeccc8522884eaf1a3a550b',
        extraction='ffmpeg -c:v libvpx-vp9 -i static/art/blight-keeper-spin.webm -pix_fmt rgba spin-frames/frame_%04d.png',
        method='reference lower cloak, side/back panel and exterior right-foot flap RGBA underlays behind each original frame; fixed native-canvas registration; preserve original opaque foreground RGB',
        polygon=[list(point) for point in polygon], maskSupersampling=4, maskFeatherPixels=.8,
        backPanelPolygon=[list(point) for point in back_polygon], backPanelMaskFeatherPixels=.65,
        footPanel=dict(reference=f'art/sources/{foot_reference_path.name}',
                       referenceSha256=hashlib.sha256(foot_reference_path.read_bytes()).hexdigest(),
                       referenceOutputFrame=32, referenceOriginalSourceFrame=6,
                       referenceRuntimeSha256='fa6f54ac874baf8598a36ecf3303df5f128759ccffeccc8522884eaf1a3a550b',
                       polygon=[list(point) for point in foot_polygon], maskSupersampling=4, maskFeatherPixels=.5,
                       alphaRemap=dict(transparentMaximum=64, opaqueMinimum=192, method='linear clamped remap before masking; preserve reference RGB')),
        preservedFingerOpening=[387, 485, 410, 535],
        edgeSmoothing=dict(method='Gaussian alpha antialiasing; retain RGB detail and extend nearest foreground RGB only at newly softened exterior pixels',
                           sigmaPixels=.55, minimumAlpha=4, snapOpaqueMinimumAlpha=252,
                           protectedRegions=protected_regions),
        addedCloakAlphaPixelsByFrame=[], addedBackPanelAlphaPixelsByFrame=[], addedFootPanelAlphaPixelsByFrame=[],
        smoothedAlphaPixelsByFrame=[], changedRgbPixelsByFrame=[])
    result, cache = [], {}
    for frame in frames:
        if frame.mode != 'RGBA' or frame.size != reference.size:
            raise ValueError('Blight cloak repair requires matching RGBA frames')
        key = hashlib.sha256(frame.tobytes()).digest()
        if key not in cache:
            original = np.array(frame)
            composite = np.array(Image.alpha_composite(underlay, frame))
            rgba = original.copy()
            rgba[patch_active] = composite[patch_active]
            alpha = rgba[:, :, 3].copy()
            smoothed = np.rint(ndimage.gaussian_filter(alpha.astype(float), sigma=.55, mode='constant')).clip(0, 255).astype(np.uint8)
            smoothed[smoothed < 4] = 0
            smoothed[smoothed >= 252] = 255
            smoothed[protected] = alpha[protected]
            newly_visible = (alpha == 0) & (smoothed > 0)
            _, nearest = ndimage.distance_transform_edt(alpha == 0, return_indices=True)
            rgba[newly_visible, :3] = rgba[nearest[0][newly_visible], nearest[1][newly_visible], :3]
            rgba[:, :, 3] = smoothed
            stats = (int(np.count_nonzero(alpha > original[:, :, 3])),
                     int(np.count_nonzero((alpha > original[:, :, 3]) & (masks[1] > 0))),
                     int(np.count_nonzero((alpha > original[:, :, 3]) & foot_active)),
                     int(np.count_nonzero(smoothed != alpha)),
                     int(np.count_nonzero(np.any(rgba[:, :, :3] != original[:, :, :3], axis=2))))
            cache[key] = (Image.fromarray(rgba), stats)
        repaired, stats = cache[key]
        result.append(repaired)
        for name, value in zip(('addedCloakAlphaPixelsByFrame', 'addedBackPanelAlphaPixelsByFrame', 'addedFootPanelAlphaPixelsByFrame', 'smoothedAlphaPixelsByFrame', 'changedRgbPixelsByFrame'), stats):
            meta[name].append(value)
    meta['uniqueInputPoses'] = len(cache)
    meta['totals'] = {name.replace('ByFrame', ''): sum(meta[name]) for name in
                      ('addedCloakAlphaPixelsByFrame', 'addedBackPanelAlphaPixelsByFrame', 'addedFootPanelAlphaPixelsByFrame', 'smoothedAlphaPixelsByFrame', 'changedRgbPixelsByFrame')}
    return result, meta


def repair_final_win(frames, source_rgb, name='bloom-traveler-big'):
    from scipy import ndimage

    plan_path = ROOT / 'art' / f'{name}-repairs.json'
    plan = json.loads(plan_path.read_text(encoding='utf-8'))
    if len(frames) != plan['frames'] or len(source_rgb) != len(frames) or any(list(frame.size) != plan['canvas'] or frame.mode != 'RGBA' for frame in frames):
        raise ValueError(f'{name} final-win repair requires all 120 native 624x832 RGBA frames')
    if hashlib.sha256((ROOT / plan['source']).read_bytes()).hexdigest() != plan['sourceSha256']:
        raise ValueError(f'{name} final-win repair source has changed')
    width, height = plan['canvas']
    black_frames = {entry['frame']: entry for entry in plan['blackMatte']['frames']}
    restores = {}
    for entry in plan['sourceRestores']:
        frame_numbers = range(entry['frameRange'][0], entry['frameRange'][1] + 1) if 'frameRange' in entry else [entry['frame']]
        for number in frame_numbers:
            restores.setdefault(number, []).append(entry)
    stats = []
    result = []
    for number, (image, rgb) in enumerate(zip(frames, source_rgb), 1):
        original = np.array(image)
        rgba = original.copy()
        alpha = rgba[:, :, 3].copy()
        source_max = rgb.max(axis=2)
        restored = np.zeros(alpha.shape, dtype=bool)
        for entry in restores.get(number, []):
            mask_image = Image.new('L', (width * 4, height * 4))
            draw = ImageDraw.Draw(mask_image)
            if 'bounds' in entry:
                x0, y0, x1, y1 = entry['bounds']
                draw.rectangle((x0 * 4, y0 * 4, x1 * 4 - 1, y1 * 4 - 1), fill=255)
            for polygon in entry.get('polygons', []):
                draw.polygon([(x * 4, y * 4) for x, y in polygon], fill=255)
            mask_image = mask_image.resize((width, height), Image.Resampling.LANCZOS)
            dilation = entry.get('polygonDilationPixels', 0)
            if dilation:
                mask_image = mask_image.filter(ImageFilter.MaxFilter(2 * dilation + 1))
            mask = np.array(mask_image.filter(ImageFilter.GaussianBlur(entry.get('maskFeatherPixels', .5)))) / 255
            if entry['kind'] == 'brown-staff':
                red, green, blue = rgb.astype(float).transpose(2, 0, 1)
                support = np.clip((red - 6) / 18, 0, 1) * (red > green * 1.25) * (red > blue * 1.5)
            else:
                transparent, opaque = entry.get('supportRamp', [18, 38])
                support = np.clip((source_max.astype(float) - transparent) / (opaque - transparent), 0, 1)
            target = np.rint(support * mask * 255).astype(np.uint8)
            raised = target > alpha
            alpha[raised] = target[raised]
            rgba[raised, :3] = rgb[raised]
            restored |= raised

        # Semantic mattes sometimes retain black background as opaque chunks.
        # Follow source-black background only; never fill genuine object gaps.
        black_removed = np.zeros(alpha.shape, dtype=bool)
        black_plan = plan['blackMatte']
        if number in black_frames:
            entry = black_frames[number]
            source_black = source_max <= black_plan['sourceRgbMaximum']
            distance = ndimage.distance_transform_edt(source_black)
            eligible = source_black & (distance >= black_plan['minimumDistanceToSourceColor'])
            for x0, y0, x1, y1 in entry['regions']:
                labels, _ = ndimage.label(eligible[y0:y1, x0:x1], structure=np.ones((3, 3)))
                chosen = np.unique(np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1])))
                for x, y in entry['backgroundSeeds']:
                    if x0 <= x < x1 and y0 <= y < y1:
                        chosen = np.append(chosen, labels[y - y0, x - x0])
                selected = np.isin(labels, chosen[chosen != 0])
                black_removed[y0:y1, x0:x1] |= selected & (alpha[y0:y1, x0:x1] > 0)
            alpha[black_removed] = 0

        # Warm lantern light makes a few known background gaps non-black.
        # Their reviewed contours exclude the real hat and wooden staff.
        for entry in plan.get('backgroundCutouts', []):
            if entry['frame'] != number:
                continue
            cutout = Image.new('L', (width * 4, height * 4))
            for polygon in entry['polygons']:
                ImageDraw.Draw(cutout).polygon([(x * 4, y * 4) for x, y in polygon], fill=255)
            cutout = np.array(cutout.resize((width, height), Image.Resampling.LANCZOS).filter(
                ImageFilter.GaussianBlur(entry.get('maskFeatherPixels', .65)))) / 255
            if 'sourceForegroundMinimum' in entry:
                foreground_distance = ndimage.distance_transform_edt(source_max < entry['sourceForegroundMinimum'])
                cutout[foreground_distance < entry.get('sourceForegroundGuardPixels', 2)] = 0
            if 'maximumAlpha' in entry:
                cutout[alpha > entry['maximumAlpha']] = 0
            changed_alpha = np.rint(alpha * (1 - cutout)).astype(np.uint8)
            black_removed |= changed_alpha < alpha
            alpha = changed_alpha

        # Remove weak dark haze outside solid artwork with a soft distance onset.
        solid = alpha >= 128
        distance = ndimage.distance_transform_edt(~solid)
        exterior = plan['weakExteriorCleanup']
        eligible = ((alpha > 0) & (alpha <= exterior['maximumAlpha']) &
                    (source_max <= exterior['sourceRgbMaximum']) & (distance >= exterior['minimumDistanceToOpaque']))
        strength = np.clip((distance - exterior['minimumDistanceToOpaque']) / exterior['distanceFeatherPixels'], 0, 1)
        before_exterior = alpha.copy()
        alpha[eligible] = np.rint(alpha[eligible] * (1 - strength[eligible])).astype(np.uint8)
        exterior_changed = int(np.count_nonzero(before_exterior != alpha))

        # Detached faint fragments cannot include the visible lantern or tool.
        detached = plan['detachedCleanup']
        labels, _ = ndimage.label(alpha > 0, structure=np.ones((3, 3)))
        detached_removed = 0
        for label, bounds in enumerate(ndimage.find_objects(labels), 1):
            if bounds is None:
                continue
            selected = labels[bounds] == label
            if (int(selected.sum()) <= detached['maximumPixels'] and
                alpha[bounds][selected].max() <= detached['maximumAlpha'] and
                rgba[bounds][:, :, :3][selected].max() <= detached['maximumRgb'] and
                distance[bounds][selected].min() >= detached['minimumDistanceToOpaque']):
                alpha[bounds][selected] = 0
                detached_removed += int(selected.sum())

        floor = plan['floorCleanup']
        x0, y0, x1, y1 = floor['region']
        floor_region = np.zeros(alpha.shape, dtype=bool)
        floor_region[y0:y1, x0:x1] = True
        eligible = (floor_region & (alpha > 0) & (alpha <= floor['maximumAlpha']) &
                    (rgba[:, :, :3].max(axis=2) <= floor['maximumRgb']) &
                    (distance >= floor['minimumDistanceToOpaque']))
        strength = np.broadcast_to(np.clip((np.arange(height) - y0) / floor['verticalFeatherPixels'], 0, 1)[:, None], alpha.shape)
        before_floor = alpha.copy()
        alpha[eligible] = np.rint(alpha[eligible] * (1 - strength[eligible])).astype(np.uint8)
        rgba[:, :, 3] = alpha
        result.append(Image.fromarray(rgba))
        stats.append(dict(frame=number, restoredSourcePixels=int(restored.sum()),
                          removedBlackMattePixels=int(black_removed.sum()),
                          cleanedWeakExteriorPixels=exterior_changed,
                          removedDetachedPixels=detached_removed,
                          cleanedFloorPixels=int(np.count_nonzero(before_floor != alpha)),
                          changedAlphaPixels=int(np.count_nonzero(alpha != original[:, :, 3])),
                          changedRgbPixels=int(np.count_nonzero(np.any(rgba[:, :, :3] != original[:, :, :3], axis=2)))))
    meta = dict(plan='art/' + plan_path.name, planSha256=hashlib.sha256(plan_path.read_bytes()).hexdigest(),
                method=plan['sourceRestoreMethod'] + '; reviewed source-black background removal and conservative exterior/floor cleanup',
                reviewedFrames=len(frames), frameNumbering=plan['frameNumbering'], perFrame=stats)
    meta['totals'] = {key: sum(entry[key] for entry in stats) for key in stats[0] if key != 'frame'}
    return result, meta


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
        blight_spin = name == 'blight-keeper-spin'
        if corrected:
            frames, source_files = corrected_bloom_frames(SOURCES / source)
            frames, alpha_cleanup = cleanup_bloom_specks(frames)
            fps, first, indices, crop = 60, 0, list(range(60)), (0, 0, *frames[0].size)
            meta = dict(source=f'art/sources/{source}', sourceFiles=source_files,
                        sourceStartSeconds=0.0, sourceEndSeconds=1.0, sourceFps=60,
                        sourceKind='user-corrected-rgba-png-sequence',
                        edit='supplied PNGs in original order; RGB and full canvas preserved; conservative detached-speck alpha cleanup only; no crop, blending or retiming',
                        alphaCleanup=alpha_cleanup)
        elif name == 'blight-keeper-big':
            frames, source_files, sequence, crop = cleaned_blight_frames(SOURCES / source)
            fps, first, indices = sequence['fps'], 0, list(range(len(frames)))
            meta = dict(source=f'art/sources/{source}', sourceFiles=source_files,
                        sourceArchive=sequence['archive'], sourceArchiveSha256=sequence['archiveSha256'],
                        sourceSequence=f'art/sources/{source}/sequence.json',
                        sourceSequenceSha256=hashlib.sha256((SOURCES / source / 'sequence.json').read_bytes()).hexdigest(),
                        sourceCanvas=sequence['sourceCanvas'],
                        sourceStartSeconds=0.0, sourceEndSeconds=5.0, sourceFps=fps,
                        sourceKind='user-cleaned-rgba-png-sequence',
                        edit='all 120 supplied PNGs in original order; preserve RGB and alpha exactly inside one shared even crop of transparent margins with two-pixel padding; no repainting, masks, compositing, scaling, blending or retiming')
        else:
            if source not in cache:
                cache[source] = decode(SOURCES / source)
            original = cache[source]
            first = round(start * 24)
            available = max(1, round(duration * 24))
            semantic_source = ('blight-spin-input.mkv' if name == 'blight-keeper-spin' else
                               'bloom-big-alpha-input.webm')
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
        if blight_spin:
            frames, alpha_cleanup = cleanup_blight_floor(frames)
            meta['alphaCleanup'] = alpha_cleanup
            frames, cloak_repair = repair_blight_cloak(frames)
            meta['cloakRepair'] = cloak_repair
            meta['edit'] += '; feathered alpha-only cleanup of isolated weak dark floor haze; frame-31 lower and side/back cloak underlays; frame-32 exterior right-foot cloak flap; protected alpha-edge antialiasing'
        if name == 'bloom-traveler-big':
            frames, final_win_repair = repair_final_win(frames, original[first:first + len(frames)], name)
            meta['finalWinRepair'] = final_win_repair
            meta['edit'] += '; reviewed all 120 frames; source-backed tool/staff/hand alpha repairs; source-black matte, detached fragment and weak exterior/floor cleanup'
        for index, frame in enumerate(frames):
            frame.save(work / f'frame-{index:03d}.png')
        room = Image.open(ROOT / 'static' / 'art' / ('bloom-room.webp' if name.startswith('bloom') else 'blight-room.webp'))
        sampled = sorted(set([0, len(frames) // 4, len(frames) // 2, 3 * len(frames) // 4, len(frames) - 1]))
        contact(frames, sampled, args.scratch / f'{name}-after-contact.jpg', room)
        meta.update(crop=list(crop), dimensions=list(frames[0].size), durationSeconds=len(frames) / fps,
                    frames=len(frames), fps=fps, sourceFrameIndices=[first + i for i in indices])
        if not args.preview_only:
            output = ROOT / 'static' / 'art' / f'{name}.webm'
            lossless = corrected or blight_spin or name.endswith('-big')
            quality = ['-lossless', '1'] if lossless else ['-crf', '25']
            # Convert color separately: swscale's RGBA-to-YUVA path rounds
            # alpha values 128..254 upward. Reattach the untouched alpha plane.
            alpha_filter = [
                '-filter_complex', '[0:v]split[color][alpha];[alpha]alphaextract[a];'
                '[color]format=yuv420p[c];[c][a]alphamerge[out]', '-map', '[out]',
            ] if lossless else []
            subprocess.run([
                'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(fps),
                '-i', str(work / 'frame-%03d.png'), *alpha_filter, '-frames:v', str(len(frames)), '-an',
                '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-b:v', '0',
                *quality, '-deadline', 'good', '-cpu-used', '3', '-metadata:s:v:0', 'alpha_mode=1', str(output)], check=True)
            poster_options = dict(lossless=True, exact=True, method=6) if lossless else dict(quality=92, method=6)
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
