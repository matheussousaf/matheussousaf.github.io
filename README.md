# matheussousaf

Static GitHub Pages homepage: https://matheussousaf.github.io/

Minimal blue-light field: handle, artwork, and links to GitHub, the notebook, and email. Native scrolling controls the sculpture while the artwork and navigation stay in view.

## Local preview

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://localhost:4173/. No build step or package install.

## Files and behavior

- `index.html`: profile links, metadata, and the no-JavaScript illustration.
- `style.css`: fixed-viewport artwork with a native scrolling document.
- `main.js`: display-synchronized canvas field with precomputed geometry, cached background, continuous highlights, and eased scroll response.
- `favicon.svg`: blue orbital mark.
- `fonts/`: a 15 KB self-hosted [JetBrains Mono Nerd Font Mono](https://github.com/ryanoasis/nerd-fonts/releases/tag/v3.5.1) subset; its SIL Open Font License is included in `fonts/OFL.txt`.

Wheel, trackpad, touch, and native keyboard scrolling rotate and reshape the field. Input listeners are passive; there is no click interaction or pause control. Reduced motion disables autonomous animation and easing, drawing only when scrolling or resizing changes the view. Hidden tabs suspend rendering. Without JavaScript, navigation and a static illustration remain available on a single-screen page.

GitHub Pages publishes the repository root from `master`; `.nojekyll` keeps the site a plain static deployment.
