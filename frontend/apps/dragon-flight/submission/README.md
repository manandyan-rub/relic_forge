# Lucky Flight upload package

Generated ZIP archives are removed during cleanup. To create a fresh frontend upload, run `pnpm build` in this app, then archive the contents of `build/`. Its `index.html` belongs at the version root.

Keep the existing math version, or create a new archive from the files in `submission/math/` for a math upload. Encounter presentation maps historical mountain-raptor events to the dragon without changing payouts. The math source files remain in `math/` and replay examples remain in `replay-examples.json`.

Rain and storm use static weather artwork and the original ambience sounds. Gameplay uses the existing bird/dragon sprites and shared-clock feather effects; fight and burst videos are no longer loaded. All runtime audio follows Sound On/Off.

`pnpm build` runs `scripts/prune-release.mjs` after Vite finishes. It removes only the generated copies of dormant WebM clips and the four old Google Sans TTF files from `build/`. The original clips, font files and artwork paths under `static/` remain saved for editing. Before removing anything, the script checks generated HTML, JavaScript, CSS and JSON for references to those assets; a reference fails the build so the upload cannot silently lose a required file. It also rejects symbolic links and validates every removal stays inside this app's resolved `build/` directory. Active WOFF2 fonts, image artwork and audio are retained. Archive the cleaned `build/`, not `.svelte-kit/` or `static/`.

To rebuild the frontend, run `pnpm build` in this app and archive the contents of `build/`. Do not upload source files, original art, tests, or development dependencies. Launch connected play through ACP with the platform-provided session parameters.
