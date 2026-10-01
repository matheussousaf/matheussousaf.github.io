# matheussousaf

Static GitHub Pages homepage: https://matheussousaf.github.io/

Minimal blue-light field: handle, luminous artwork, and particles linking to GitHub, the notebook, and email. Native scrolling disturbs and opens the sculpture, moving into its interior rather than rotating it.

## Local preview

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://localhost:4173/. No build step or package install.

## Files and behavior

- `index.html`: profile links, metadata, and the no-JavaScript illustration.
- `style.css`: fixed-viewport artwork, hidden scrollbars, a scroll cue, and accessible particle-link targets.
- `main.js`: display-synchronized canvas field with precomputed fixed-orientation geometry, cached background, flowing highlights, and eased scroll-driven opening and entry.
- `favicon.svg`: blue orbital mark.
- `fonts/`: a 15 KB self-hosted [JetBrains Mono Nerd Font Mono](https://github.com/ryanoasis/nerd-fonts/releases/tag/v3.5.1) subset; its SIL Open Font License is included in `fonts/OFL.txt`.

Wheel, trackpad, touch, and native keyboard scrolling spread the filaments and move into the field; scrolling back closes it. The small `scroll` cue remains until the interior links emerge. Scrollbars are hidden without disabling native scrolling. Inside, three stable particles link to work, notebook, and contact. Hidden links are inert, and keyboard focus is cleared when scrolling back hides them.

The form does not spin; ambient breathing, highlights, and depth particles remain animated. The artwork itself has no click effect or pause control. Reduced motion disables autonomous animation and easing, applying scroll changes directly without idle rendering. Hidden tabs suspend rendering. Without JavaScript, a static illustration and ordinary navigation links remain available on a single-screen page.

GitHub Pages publishes the repository root from `master`; `.nojekyll` keeps the site a plain static deployment.
