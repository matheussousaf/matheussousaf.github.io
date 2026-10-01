const root = document.documentElement;
const surface = document.querySelector(".field");
const canvas = surface.querySelector("canvas");
const context = canvas.getContext("2d", { alpha: false });
const background = document.createElement("canvas");
const backdrop = background.getContext("2d", { alpha: false });
const glow = document.createElement("canvas");
const glowContext = glow.getContext("2d");

if (context && backdrop && glowContext) {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const TAU = Math.PI * 2;
  const strands = 30;
  const samples = 192;
  const stride = samples + 1;
  const vertexCount = strands * stride;
  // Knot centre line and tube offsets, already turned into the fixed viewing pose.
  const coreX = new Float32Array(stride);
  const coreY = new Float32Array(stride);
  const coreZ = new Float32Array(stride);
  const offsetX = new Float32Array(vertexCount);
  const offsetY = new Float32Array(vertexCount);
  const offsetZ = new Float32Array(vertexCount);
  const projectedX = new Float32Array(vertexCount);
  const projectedY = new Float32Array(vertexCount);
  const waveSin = new Float32Array(stride);
  const waveCos = new Float32Array(stride);
  const sampleWave = new Float32Array(stride);
  const strandWidth = new Float32Array(strands);
  const strandSpread = new Float32Array(strands);
  const strandLift = new Float32Array(strands);
  const colors = Array.from({ length: strands }, (_, i) =>
    i % 5 === 0 ? "rgba(195,237,255,.72)" : `rgba(75,184,246,${.23 + i % 4 * .055})`
  );
  const trailColors = Array.from({ length: 4 }, (_, segment) => `rgba(193,239,255,${.15 + segment * .16})`);

  let seed = 7343;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  // The knot never turns: one fixed pose is baked into the geometry.
  const poseSinX = Math.sin(.92), poseCosX = Math.cos(.92);
  const poseSinY = Math.sin(-.26), poseCosY = Math.cos(-.26);
  function pose(x, y, z, targetX, targetY, targetZ, index) {
    const yy = y * poseCosX - z * poseSinX;
    const zz = y * poseSinX + z * poseCosX;
    targetX[index] = x * poseCosY + zz * poseSinY;
    targetY[index] = yy;
    targetZ[index] = zz * poseCosY - x * poseSinY;
  }

  // Build the tube once. Breathing, splay and projection change per frame.
  for (let i = 0; i <= samples; i++) {
    const t = i / samples * TAU;
    const c2 = Math.cos(2 * t);
    const s2 = Math.sin(2 * t);
    const c3 = Math.cos(3 * t);
    const s3 = Math.sin(3 * t);
    const radius = 2 + .62 * c3;
    let tx = -1.86 * s3 * c2 - 2 * radius * s2;
    let ty = -1.86 * s3 * s2 + 2 * radius * c2;
    let tz = 2.7 * c3;
    const tangentLength = Math.hypot(tx, ty, tz);
    tx /= tangentLength; ty /= tangentLength; tz /= tangentLength;
    let bx = -tz * s2;
    let by = tz * c2;
    let bz = tx * s2 - ty * c2;
    const binormalLength = Math.hypot(bx, by, bz);
    bx /= binormalLength; by /= binormalLength; bz /= binormalLength;
    const nx = by * tz - bz * ty;
    const ny = bz * tx - bx * tz;
    const nz = bx * ty - by * tx;
    pose(radius * c2 * 76, radius * s2 * 76, .9 * s3 * 76, coreX, coreY, coreZ, i);
    for (let j = 0; j < strands; j++) {
      const u = j / strands * TAU;
      const a = Math.cos(u) * (.23 + .05 * s3) * 76;
      const b = Math.sin(u) * (.23 + .05 * s3) * 76;
      pose(a * nx + b * bx, a * ny + b * by, a * nz + b * bz, offsetX, offsetY, offsetZ, j * stride + i);
    }
    // The travelling ripple is sin(3t + phase); keep its sample-dependent half precomputed.
    waveSin[i] = Math.sin(3 * t) * .018;
    waveCos[i] = Math.cos(3 * t) * .018;
  }
  for (let j = 0; j < strands; j++) {
    strandWidth[j] = j % 5 === 0 ? .75 : .45;
    // Each filament leaves the bundle by its own amount, so opening reads as splaying.
    strandSpread[j] = .7 + random() * 2.3;
    strandLift[j] = .86 + random() * .28;
  }

  const stars = Array.from({ length: 160 }, () => ({ x: random(), y: random(), radius: .2 + random() * .65, opacity: .06 + random() * .28 }));
  // Depth motes: fixed directions, travelling only along the view axis.
  const particles = Array.from({ length: 100 }, () => {
    const angle = random() * TAU;
    return {
      sin: Math.sin(angle),
      cos: Math.cos(angle),
      radius: 150 + random() * 160,
      phase: random(),
      drift: .004 + random() * .008,
      travel: 1 + random() * 1.4,
      size: .35 + random() * .8,
      opacity: .15 + random() * .5,
    };
  });
  const hatch = Array.from({ length: 240 }, (_, i) => ({ angle: i / 240 * TAU, radius: 272 + random() * 30, length: 4 + random() * 20 }));

  // One soft light sprite serves the inner chamber and every beacon bloom.
  glow.width = glow.height = 128;
  const light = glowContext.createRadialGradient(64, 64, 0, 64, 64, 64);
  light.addColorStop(0, "rgba(160,226,255,1)");
  light.addColorStop(.22, "rgba(72,178,246,.42)");
  light.addColorStop(.6, "rgba(28,110,190,.1)");
  light.addColorStop(1, "rgba(12,60,110,0)");
  glowContext.fillStyle = light;
  glowContext.fillRect(0, 0, 128, 128);

  const FOCAL = 900;
  const HOLE = .74;
  const nav = document.querySelector(".particle-links");
  const beacons = nav ? ["work", "notebook", "contact"].flatMap((name, index) => {
    const link = nav.querySelector(`.particle-link[data-particle="${name}"]`);
    // A loose triangle across the opened interior; labels hang below each point.
    const anchor = [[-.62, -.52], [.7, -.08], [-.12, .66]][index];
    return link ? [{ link, anchorX: anchor[0], anchorY: anchor[1], x: 0, y: 0, alpha: 0, size: 0, shownX: "", shownY: "", shownSize: "", shownAlpha: "" }] : [];
  }) : [];

  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let scale = 1;
  let centerX = 0;
  let centerY = 0;
  let inverseHalfWidth = 1;
  let inverseHalfHeight = 1;
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
  let destroyed = false;
  let pointX = 0;
  let pointY = 0;

  function smoothstep(from, to, value) {
    const t = value <= from ? 0 : value >= to ? 1 : (value - from) / (to - from);
    return t * t * (3 - 2 * t);
  }

  function cacheBackground() {
    background.width = canvas.width;
    background.height = canvas.height;
    backdrop.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    backdrop.fillStyle = "#030a11";
    backdrop.fillRect(0, 0, width, height);
    const aura = backdrop.createRadialGradient(centerX, centerY, 0, centerX, centerY, 460 * scale);
    aura.addColorStop(0, "#0b324e");
    aura.addColorStop(.35, "#071f32");
    aura.addColorStop(.68, "#04111d");
    aura.addColorStop(1, "#030a11");
    backdrop.fillStyle = aura;
    backdrop.fillRect(0, 0, width, height);
    backdrop.fillStyle = "#91c9ed";
    for (const star of stars) {
      backdrop.globalAlpha = star.opacity;
      backdrop.beginPath();
      backdrop.arc(star.x * width, star.y * height, star.radius, 0, TAU);
      backdrop.fill();
    }
    backdrop.globalAlpha = 1;
    backdrop.save();
    backdrop.translate(centerX, centerY);
    backdrop.scale(scale, scale);
    backdrop.lineWidth = .6;
    backdrop.strokeStyle = "#539ed91a";
    backdrop.beginPath();
    for (const ray of hatch) {
      const x = Math.cos(ray.angle);
      const y = Math.sin(ray.angle) * .84;
      backdrop.moveTo(x * ray.radius, y * ray.radius);
      backdrop.lineTo(x * (ray.radius + ray.length), y * (ray.radius + ray.length));
    }
    backdrop.stroke();
    backdrop.strokeStyle = "#6caacf24";
    backdrop.beginPath();
    backdrop.moveTo(0, -287); backdrop.lineTo(0, -278);
    backdrop.moveTo(-337, 0); backdrop.lineTo(-329, 0);
    backdrop.moveTo(329, 0); backdrop.lineTo(337, 0);
    backdrop.stroke();
    backdrop.translate(0, 296);
    backdrop.scale(1, .12);
    const floor = backdrop.createRadialGradient(0, 0, 0, 0, 0, 120);
    floor.addColorStop(0, "#8ad5ff3a");
    floor.addColorStop(.3, "#398bcc16");
    floor.addColorStop(1, "#0b315200");
    backdrop.fillStyle = floor;
    backdrop.fillRect(-120, -120, 240, 240);
    backdrop.restore();
    // A fixed, sparse grain gives the light a printed texture without a per-frame filter.
    backdrop.fillStyle = "#accce90a";
    for (let i = 0; i < 4500; i++) backdrop.fillRect(random() * width, random() * height, .7, .7);
  }

  // Interpolated point along one strand, so moving highlights glide between samples.
  function samplePoint(start, position) {
    if (position >= samples) position -= samples;
    const whole = position | 0;
    const fraction = position - whole;
    const k = start + whole;
    pointX = projectedX[k] + (projectedX[k + 1] - projectedX[k]) * fraction;
    pointY = projectedY[k] + (projectedY[k + 1] - projectedY[k]) * fraction;
  }

  function setReady(next) {
    if (next === ready || !nav) return;
    ready = next;
    if (!next && nav.contains(document.activeElement)) document.activeElement.blur();
    nav.dataset.ready = String(next);
    nav.inert = !next;
    if (next) nav.removeAttribute("aria-hidden");
    else nav.setAttribute("aria-hidden", "true");
  }

  // Beacons rise out of the chamber's depth to fixed resting points; the DOM links follow them.
  function placeBeacons(reveal) {
    for (let i = 0; i < beacons.length; i++) {
      const beacon = beacons[i];
      const entry = smoothstep(i * .14, i * .14 + .72, reveal);
      const eased = 1 - (1 - entry) * (1 - entry) * (1 - entry);
      const depth = FOCAL / (2600 - 1700 * eased);
      beacon.x = beacon.anchorX * spanX * depth;
      beacon.y = beacon.anchorY * spanY * depth;
      beacon.size = depth;
      beacon.alpha = smoothstep(.15, .85, entry);
      const alpha = beacon.alpha.toFixed(3);
      if (alpha !== beacon.shownAlpha) beacon.link.style.setProperty("--alpha", beacon.shownAlpha = alpha);
      if (!beacon.alpha) continue;
      const x = `${(centerX + beacon.x).toFixed(1)}px`;
      const y = `${(centerY + beacon.y).toFixed(1)}px`;
      const size = depth.toFixed(3);
      if (x !== beacon.shownX) beacon.link.style.setProperty("--px", beacon.shownX = x);
      if (y !== beacon.shownY) beacon.link.style.setProperty("--py", beacon.shownY = y);
      if (size !== beacon.shownSize) beacon.link.style.setProperty("--size", beacon.shownSize = size);
    }
    // Clickable only while every beacon is ≥ .95 scale (48px box stays ≥ 44px) and fully visible.
    if (ready ? reveal < .75 : reveal >= .88) setReady(!ready);
    else if (ready === null) setReady(false);
  }

  function draw() {
    // Scroll stages: the aperture opens, the camera moves inside, then the beacons surface.
    const open = smoothstep(.03, .4, progress);
    const enter = smoothstep(.28, .82, progress);
    const reveal = smoothstep(.68, .93, progress);
    const hole = open * .5 + enter * (HOLE - .5);
    const camera = FOCAL - enter * 240;
    const lineScale = scale * (1 + enter * .4);
    const cueOpacity = (1 - smoothstep(.6, .9, progress)).toFixed(2);
    if (cueOpacity !== cue) root.style.setProperty("--cue-opacity", cue = cueOpacity);
    placeBeacons(reveal);

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.drawImage(background, 0, 0);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, centerX * pixelRatio, centerY * pixelRatio);
    context.globalCompositeOperation = "lighter";

    // Light gathering behind the opening, becoming the interior chamber.
    const chamber = .1 * open + .22 * enter;
    if (chamber > 0) {
      const chamberX = (.18 + hole) * width * .62;
      const chamberY = (.18 + hole) * height * .62;
      context.globalAlpha = chamber;
      context.drawImage(glow, -chamberX, -chamberY, chamberX * 2, chamberY * 2);
      context.globalAlpha = 1;
    }

    const breath = 1 + Math.sin(time * .85) * .027;
    const bob = Math.sin(time * .63) * 7 * scale * (1 - enter * .7);
    const wavePhase = time * 1.1;
    const waveGain = 1 + agitation * 4;
    const waveS = Math.sin(wavePhase) * waveGain;
    const waveC = Math.cos(wavePhase) * waveGain;
    const parallaxX = pointerX * 9 * scale;
    const parallaxY = pointerY * 9 * scale;
    for (let i = 0; i <= samples; i++) sampleWave[i] = waveSin[i] * waveC + waveCos[i] * waveS;
    for (let strand = 0; strand < strands; strand++) {
      const start = strand * stride;
      const spread = 1 + (open + agitation * .35) * strandSpread[strand];
      const lift = hole * strandLift[strand];
      const liftSquared = lift * lift;
      for (let i = 0; i <= samples; i++) {
        const k = start + i;
        const pulse = breath + sampleWave[i];
        const z = (coreZ[i] + offsetZ[k] * spread) * pulse;
        const distance = camera - z;
        const perspective = FOCAL / (distance > 220 ? distance : 220) * scale;
        const depthShift = perspective / scale - .6;
        let x = (coreX[i] + offsetX[k] * spread) * pulse * perspective + parallaxX * depthShift;
        let y = (coreY[i] + offsetY[k] * spread) * pulse * perspective + parallaxY * depthShift + bob;
        if (liftSquared > 0) {
          // Radial aperture in viewport-normalised space: the centre clears into an ellipse of radius `lift`.
          const nx = x * inverseHalfWidth;
          const ny = y * inverseHalfHeight;
          const radiusSquared = nx * nx + ny * ny;
          const push = Math.sqrt((radiusSquared + liftSquared) / (radiusSquared + 1e-9));
          x *= push;
          y *= push;
        }
        projectedX[k] = x;
        projectedY[k] = y;
      }
    }

    context.lineJoin = "round";
    // One combined glow pass; sharp filaments are drawn separately on top.
    context.beginPath();
    for (let strand = 0; strand < strands; strand += 3) {
      const start = strand * stride;
      context.moveTo(projectedX[start], projectedY[start]);
      for (let i = 1; i <= samples; i++) context.lineTo(projectedX[start + i], projectedY[start + i]);
    }
    context.strokeStyle = "rgba(45,160,255,.11)";
    context.lineWidth = 4 * lineScale;
    context.shadowColor = "#22aaff";
    context.shadowBlur = 12 * pixelRatio;
    context.stroke();
    context.shadowBlur = 0;

    for (let strand = 0; strand < strands; strand++) {
      const start = strand * stride;
      context.beginPath();
      context.moveTo(projectedX[start], projectedY[start]);
      for (let i = 1; i <= samples; i++) context.lineTo(projectedX[start + i], projectedY[start + i]);
      context.strokeStyle = colors[strand];
      context.lineWidth = strandWidth[strand] * lineScale;
      context.stroke();
    }

    // Small, travelling highlights make the surface feel like flowing light, not a rigid wireframe.
    context.lineWidth = .95 * lineScale;
    context.fillStyle = "#d9f6ff";
    for (let stream = 0; stream < 8; stream++) {
      const start = (stream * 4) % strands * stride;
      const head = (time * (16 + stream * .6) + stream * 23) % samples;
      for (let segment = 0; segment < 4; segment++) {
        let from = head - 20 + segment * 5;
        if (from < 0) from += samples;
        const to = from + 5;
        context.beginPath();
        samplePoint(start, from);
        context.moveTo(pointX, pointY);
        for (let step = Math.floor(from) + 1; step < to; step++) {
          const index = start + (step < samples ? step : step - samples);
          context.lineTo(projectedX[index], projectedY[index]);
        }
        samplePoint(start, to);
        context.lineTo(pointX, pointY);
        context.strokeStyle = trailColors[segment];
        context.stroke();
      }
      samplePoint(start, head);
      context.beginPath();
      context.arc(pointX, pointY, 1.05 * lineScale, 0, TAU);
      context.fill();
    }

    // The fixed orbit line widens with the aperture and dissolves once inside.
    if (enter < 1) {
      const ring = scale * (1 + open * .6);
      context.globalAlpha = 1 - enter;
      context.lineWidth = .45 * scale;
      context.strokeStyle = "#639cc239";
      context.beginPath();
      context.ellipse(0, 0, 275 * ring, 103 * ring, -.5, 0, TAU);
      context.stroke();
    }

    // Motes drift slowly toward the viewer; scrolling carries them past the camera.
    const twinkleS = Math.sin(time * .9);
    const twinkleC = Math.cos(time * .9);
    const far = 1100 + enter * 500;
    const near = 700 - enter * 540;
    const flatten = .7 + enter * .3;
    const moteLift = hole * .55;
    const moteLiftSquared = moteLift * moteLift;
    context.fillStyle = "#b0e4ff";
    for (const particle of particles) {
      let phase = particle.phase + time * particle.drift + progress * particle.travel;
      phase -= Math.floor(phase);
      const perspective = FOCAL / (far - phase * (far - near));
      const fade = 4 * phase * (1 - phase);
      let x = particle.cos * particle.radius * perspective * scale + parallaxX * perspective;
      let y = particle.sin * particle.radius * flatten * perspective * scale + parallaxY * perspective;
      if (moteLiftSquared > 0) {
        const nx = x * inverseHalfWidth;
        const ny = y * inverseHalfHeight;
        const radiusSquared = nx * nx + ny * ny;
        const push = Math.sqrt((radiusSquared + moteLiftSquared) / (radiusSquared + 1e-9));
        x *= push;
        y *= push;
      }
      const size = particle.size * Math.sqrt(perspective);
      context.globalAlpha = particle.opacity * fade * (.72 + .28 * (twinkleS * particle.cos + twinkleC * particle.sin));
      context.beginPath();
      context.arc(x, y, size < 3 ? size : 3, 0, TAU);
      context.fill();
    }

    // Bloom under each beacon, breathing gently in place.
    for (let i = 0; i < beacons.length; i++) {
      const beacon = beacons[i];
      if (!beacon.alpha) continue;
      const radius = 54 * beacon.size * (1 + Math.sin(time * 1.4 + i * 2.1) * .06);
      context.globalAlpha = beacon.alpha * .55;
      context.drawImage(glow, beacon.x - radius, beacon.y - radius, radius * 2, radius * 2);
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
  }

  function tick(now) {
    frame = 0;
    if (document.hidden || destroyed) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, .1) : 1 / 60;
    lastTime = now;
    if (reduced) {
      // No autonomous motion: show the exact scroll state once, then stop.
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
    // Scrolling ruffles the filaments; the ruffle settles once the scene catches up.
    const disturbance = Math.min(1, Math.abs(lag) * 10);
    agitation = Math.max(disturbance, agitation * Math.exp(-dt * 2.2));
    draw();
    frame = requestAnimationFrame(tick);
  }
  function render() {
    if (!frame && !document.hidden && !destroyed) frame = requestAnimationFrame(tick);
  }
  // Reduced motion draws only when the shown scroll state is stale; otherwise the loop runs.
  function refresh() {
    if (!reduced || progress !== scrollTarget) render();
  }
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }

  function readScroll() {
    const position = scrollY / scrollRange;
    scrollTarget = position < 0 ? 0 : position > 1 ? 1 : position;
  }
  function measureScroll() {
    scrollRange = Math.max(1, root.scrollHeight - innerHeight);
    readScroll();
  }
  function layout() {
    const rect = surface.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    measureScroll();
    if (rect.width !== width || rect.height !== height || ratio !== pixelRatio) {
      width = rect.width;
      height = rect.height;
      pixelRatio = ratio;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      centerX = width * .5;
      centerY = height * .48;
      scale = Math.min(width / 610, height / 690, 1.3);
      inverseHalfWidth = 2 / Math.max(width, 1);
      inverseHalfHeight = 2 / Math.max(height, 1);
      // Beacon spread: inside the opened hole, with room for labels below and 72px side margins.
      spanX = Math.max(0, Math.min(centerX - 72, centerX * HOLE * .8, 360));
      spanY = Math.max(0, Math.min(centerY - 104, height * .5 * HOLE * .8, 230));
      for (const beacon of beacons) beacon.shownX = beacon.shownY = "";
      cacheBackground();
      // Resizing clears the bitmap; repaint now so no blank frame is presented.
      draw();
    }
    refresh();
  }

  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const passive = { signal: listeners.signal, passive: true };
  addEventListener("scroll", () => {
    readScroll();
    refresh();
  }, passive);
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
    targetX = pointerX = targetY = pointerY = 0;
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
  // Preserve back/forward-cache restoration without retaining a live loop off-page.
  addEventListener("pagehide", event => {
    stop();
    if (!event.persisted) { destroyed = true; observer.disconnect(); listeners.abort(); }
  }, options);
  addEventListener("pageshow", () => {
    layout();
    if (!reduced) progress = scrollTarget;
    refresh();
  }, options);

  root.classList.add("has-field");
  measureScroll();
  progress = scrollTarget;
  layout();
  observer.observe(surface);
  observer.observe(root);
  document.querySelector(".still").setAttribute("hidden", "");
}
