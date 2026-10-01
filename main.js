import { PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";
import { createField } from "./field.js";
import { createParticles, PARTICLE_CAPACITY } from "./particles.js";

const root = document.documentElement;
const surface = document.querySelector(".field");
const canvas = surface.querySelector("canvas");
const still = surface.querySelector(".still");
const nav = document.querySelector(".particle-links");

function showFallback() {
  root.classList.remove("has-field");
  canvas.style.display = "none";
  still.removeAttribute("hidden");
  nav.inert = false;
  nav.removeAttribute("aria-hidden");
  nav.removeAttribute("data-ready");
}

let renderer;
try {
  renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
} catch (error) {
  console.warn("WebGL unavailable; showing the static field.", error);
  showFallback();
}
if (renderer) startField(renderer);

function startField(renderer) {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 24, 4000);
  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: 1 },
    uFocal: { value: 900 },
    uCameraZ: { value: 900 },
  };
  const field = createField(uniforms);
  const particles = createParticles(uniforms);
  scene.add(field, particles);
  renderer.setClearColor(0x000000, 0);

  const anchors = [[-.62, -.52], [.7, -.08], [-.12, .66]];
  const beacons = ["work", "notebook", "contact"].map((name, index) => ({
    link: nav.querySelector(`[data-particle="${name}"]`),
    anchor: anchors[index],
    position: new Vector3(),
    shownX: "", shownY: "", shownSize: "", shownAlpha: "",
  }));
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let scale = 1;
  let spanX = 0;
  let spanY = 0;
  let time = 0;
  let lastTime = 0;
  let frame = 0;
  let reduced = reducedMotion.matches;
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;
  let scrollRange = 1;
  let scrollTarget = 0;
  let progress = 0;
  let agitation = 0;
  let ready = null;
  let cue = "";
  let lost = false;
  let destroyed = false;

  function smoothstep(from, to, value) {
    const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
    return t * t * (3 - 2 * t);
  }
  function setReady(next) {
    if (next === ready) return;
    ready = next;
    if (!next && nav.contains(document.activeElement)) document.activeElement.blur();
    nav.dataset.ready = String(next);
    nav.inert = !next;
    if (next) nav.removeAttribute("aria-hidden");
    else nav.setAttribute("aria-hidden", "true");
  }
  function placeBeacons(reveal) {
    const depth = 900 / (camera.position.z + 800);
    for (let i = 0; i < beacons.length; i++) {
      const beacon = beacons[i];
      const entry = smoothstep(i * .14, i * .14 + .72, reveal);
      const alpha = smoothstep(.15, .85, entry).toFixed(3);
      if (alpha !== beacon.shownAlpha) beacon.link.style.setProperty("--alpha", beacon.shownAlpha = alpha);
      if (alpha === "0.000") continue;
      // Real world-space destinations behind the field, projected onto native HTML links.
      beacon.position.set(beacon.anchor[0] * spanX / scale, -beacon.anchor[1] * spanY / scale, -800).project(camera);
      const x = ((beacon.position.x + 1) * width * .5).toFixed(1) + "px";
      const y = ((1 - beacon.position.y) * height * .5).toFixed(1) + "px";
      const size = depth.toFixed(3);
      if (x !== beacon.shownX) beacon.link.style.setProperty("--px", beacon.shownX = x);
      if (y !== beacon.shownY) beacon.link.style.setProperty("--py", beacon.shownY = y);
      if (size !== beacon.shownSize) beacon.link.style.setProperty("--size", beacon.shownSize = size);
    }
    // Reveal only when all targets are visible and their 48px boxes exceed 44px.
    if (ready ? reveal < .75 : reveal >= .88) setReady(!ready);
    else if (ready === null) setReady(false);
  }
  function draw() {
    if (lost || destroyed) return;
    const enter = smoothstep(0, 1, progress);
    camera.position.set(-pointerX * 9, pointerY * 9, 900 - enter * 800);
    camera.updateMatrixWorld();
    uniforms.uTime.value = time;
    uniforms.uCameraZ.value = camera.position.z;
    field.scale.setScalar(1 + Math.sin(time * .85) * .027 + agitation * .012);
    placeBeacons(smoothstep(.68, .93, progress));
    const opacity = (1 - smoothstep(.6, .9, progress)).toFixed(2);
    if (opacity !== cue) root.style.setProperty("--cue-opacity", cue = opacity);
    renderer.render(scene, camera);
  }
  function tick(now) {
    frame = 0;
    if (document.hidden || destroyed || lost) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, .1) : 1 / 60;
    lastTime = now;
    if (reduced) {
      progress = scrollTarget;
      agitation = 0;
      draw();
      return;
    }
    time += dt;
    const follow = 1 - Math.exp(-dt * 4.5);
    pointerX += (targetX - pointerX) * follow;
    pointerY += (targetY - pointerY) * follow;
    const lag = scrollTarget - progress;
    progress += lag * (1 - Math.exp(-dt * 5));
    agitation = Math.max(Math.min(1, Math.abs(lag) * 10), agitation * Math.exp(-dt * 2.2));
    draw();
    frame = requestAnimationFrame(tick);
  }
  function render() {
    if (!frame && !document.hidden && !destroyed && !lost) frame = requestAnimationFrame(tick);
  }
  function refresh() {
    if (!reduced || progress !== scrollTarget) render();
  }
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }
  function readScroll() {
    scrollTarget = Math.max(0, Math.min(1, scrollY / scrollRange));
  }
  function layout() {
    if (lost || destroyed) return;
    const rect = surface.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    scrollRange = Math.max(1, root.scrollHeight - innerHeight);
    readScroll();
    if (width !== rect.width || height !== rect.height || pixelRatio !== ratio) {
      width = rect.width;
      height = rect.height;
      pixelRatio = ratio;
      scale = Math.min(width / 610, height / 690, 1.3);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = 2 * Math.atan(height / (2 * 900 * scale)) * 180 / Math.PI;
      camera.setViewOffset(width, height, 0, height * .02, width, height);
      camera.updateProjectionMatrix();
      uniforms.uFocal.value = 900 * scale;
      uniforms.uPixelRatio.value = pixelRatio;
      particles.geometry.setDrawRange(0, Math.min(PARTICLE_CAPACITY, Math.max(1000, Math.round(width * height / 400))));
      spanX = Math.max(0, Math.min(width * .5 - 72, width * .296, 360));
      spanY = Math.max(0, Math.min(height * .48 - 104, height * .296, 230));
      draw();
    }
    refresh();
  }

  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const passive = { signal: listeners.signal, passive: true };
  addEventListener("scroll", () => { readScroll(); refresh(); }, passive);
  addEventListener("pointermove", event => {
    if (reduced || event.pointerType === "touch") return;
    targetX = event.clientX / width * 2 - 1;
    targetY = event.clientY / height * 2 - 1;
  }, passive);
  addEventListener("pointerout", event => {
    if (!event.relatedTarget) targetX = targetY = 0;
  }, passive);
  reducedMotion.addEventListener("change", () => {
    reduced = reducedMotion.matches;
    pointerX = targetX = pointerY = targetY = 0;
    progress = scrollTarget;
    agitation = 0;
    stop();
    render();
  }, options);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else refresh();
  }, options);
  addEventListener("resize", layout, passive);
  const observer = new ResizeObserver(layout);
  canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    lost = true;
    stop();
    showFallback();
  }, options);
  canvas.addEventListener("webglcontextrestored", () => {
    lost = false;
    width = height = 0;
    ready = null;
    root.classList.add("has-field");
    canvas.style.display = "";
    layout();
    progress = scrollTarget;
    draw();
    still.setAttribute("hidden", "");
  }, options);
  addEventListener("pagehide", event => {
    stop();
    if (event.persisted) return;
    destroyed = true;
    observer.disconnect();
    listeners.abort();
    const geometries = new Set();
    const materials = new Set();
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) materials.add(object.material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    renderer.dispose();
  }, options);
  addEventListener("pageshow", () => { layout(); refresh(); }, options);

  root.classList.add("has-field");
  scrollRange = Math.max(1, root.scrollHeight - innerHeight);
  readScroll();
  progress = scrollTarget;
  layout();
  observer.observe(surface);
  observer.observe(root);
  still.setAttribute("hidden", "");
}
