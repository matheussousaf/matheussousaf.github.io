# Matheus Figueirêdo

Static GitHub Pages homepage: https://matheussousaf.github.io/

The selected design is a minimal blue-light field: name, artwork, and links to GitHub, the notebook, and email. The alternate sketches and their switcher have been removed.

## Local preview

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://localhost:4173/. No build step or dependencies.

## Files and behavior

- `index.html`: accessible controls, profile links, metadata, and the no-JavaScript illustration.
- `style.css`: full-viewport responsive layout.
- `main.js`: canvas field with precomputed geometry, cached background, flowing highlights, pointer response, and click/touch pulses.
- `favicon.svg`: blue orbital mark.

The pause control stops animation. Reduced motion starts with a still frame; the artwork button remains usable with touch or the keyboard. Hidden tabs suspend rendering. Navigation and a static illustration remain available without JavaScript.

GitHub Pages publishes the repository root from `master`; `.nojekyll` keeps the site a plain static deployment.
