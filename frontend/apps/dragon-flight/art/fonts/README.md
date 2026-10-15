# Lucky Flight typography

The UI uses Google Sans, and titles use Cinzel. These are existing typeface designs,
not generated artwork. Both are distributed under the SIL Open Font License 1.1.

Verified sources on 2026-10-14:

- [Google Sans project and license](https://github.com/googlefonts/googlesans)
- [Cinzel license in the official Google Fonts repository](https://github.com/google/fonts/blob/main/ofl/cinzel/OFL.txt)

The deployed `static/fonts/` directory contains unmodified official variable WOFF2
files, local license notices, and `font-manifest.json` with download URLs, sizes,
and SHA-256 hashes. Fonts are served by the game; no runtime Google Fonts request
or new JavaScript dependency is required. All seven subsets total 172,576 bytes.
Latin Google Sans plus Latin Cinzel total 61,872 bytes; browsers request other
subsets only for matching characters. Writing systems not covered by these
subsets use installed fallback fonts.

The four original Google Sans TTF files remain at their original `static/fonts/`
paths. Their embedded names, copyright notices and license URL were checked;
they total 7,620,964 bytes. They are no longer loaded by the game and are excluded
from the generated release through its asset pruning step. Runtime typography is controlled through `--font-ui` and
`--font-display`, with ordinary inherited control fonts rather than blanket
`!important` rules.
