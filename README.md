# matheussousaf

Static GitHub Pages homepage: https://matheussousaf.github.io/

Minimal blue-light forcefield built with [Three.js](https://threejs.org/): handle, luminous filaments, a dense particle cloud, and particles linking to GitHub, the notebook, and email. Native scrolling moves a perspective camera into the field; the geometry does not rotate or open a hole in its center.

## Build and local preview

```sh
npm ci
npm run build
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://localhost:4173/. Rebuild after editing JavaScript. Three.js and esbuild are pinned in `package.json` and `package-lock.json`; the browser loads the self-hosted bundle, not a CDN.

## Files and behavior

- `index.html`: profile links, metadata, and the no-JavaScript illustration.
- `style.css`: fixed-viewport artwork, hidden scrollbars, a scroll cue, and accessible particle-link targets.
- `main.js`: Three.js renderer, perspective camera, scroll choreography, projected native navigation links, and lifecycle handling.
- `field.js`: fixed world-space knot geometry, fine filament cores, soft halos, and GPU-driven flowing highlights using Three.js line addons.
- `particles.js`: one GPU `Points` cloud with procedural light sprites, depth wrapping, and near/far fades.
- `assets/main.js`: generated, minified browser bundle. Commit it with source changes; dependency notices are in `assets/main.js.LEGAL.txt` and `assets/THREE-LICENSE.txt`.
- `favicon.svg`: blue orbital mark.
- `fonts/`: a 15 KB self-hosted [JetBrains Mono Nerd Font Mono](https://github.com/ryanoasis/nerd-fonts/releases/tag/v3.5.1) subset; its SIL Open Font License is included in `fonts/OFL.txt`.

Wheel, trackpad, touch, and native keyboard scrolling move the camera forward through the strands and particles; scrolling back retreats to the original view. The small `scroll` cue remains until the interior links emerge. Scrollbars are hidden without disabling native scrolling. Inside, three particles link to work, notebook, and contact. Hidden links are inert, and keyboard focus is cleared when scrolling back hides them.

The cloud scales from 1,000 particles on small viewports to a maximum of 4,096. Particle movement, fading, and highlights run in shaders over static geometry: three filament passes and one particle pass, with no per-frame geometry uploads. Pixel ratio is capped at 1.5, and no full-screen postprocessing is used.

The form does not spin; ambient breathing, highlights, and depth particles remain animated. The artwork itself has no click effect or pause control. Reduced motion disables autonomous animation and easing, applying scroll changes directly without idle rendering. Hidden tabs suspend rendering. Without JavaScript or WebGL, a static illustration and ordinary navigation links remain available on a single-screen page. WebGL context loss exposes that fallback until the context is restored.

GitHub Pages publishes the repository root from `master`; `.nojekyll` keeps the site a plain static deployment. Run `npm run build` and commit the generated `assets/` files before publishing JavaScript changes.
