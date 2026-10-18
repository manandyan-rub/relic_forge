"""Retired preblended-loop preparation entry point.

Use prepare-character-media.py to build from original RGB poses and preserved
semantic alpha. The legacy temporal blending path compounded ghosting and did
not honor source-start offsets; it must not regenerate production assets.
"""
if __name__ == '__main__':
    raise SystemExit(
        'This legacy loop builder is retired. Run: python scripts/prepare-character-media.py --scratch <temporary-directory>'
    )
