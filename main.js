const root = document.documentElement;
const surface = document.querySelector(".field");
const canvas = surface.querySelector("canvas");
const context = canvas.getContext("2d", { alpha: false });
const background = document.createElement("canvas");
const backdrop = background.getContext("2d", { alpha: false });

if (context && backdrop) {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const TAU = Math.PI * 2;
  const strands = 30;
  const samples = 192;
  const stride = samples + 1;
  const vertexCount = strands * stride;
  const baseX = new Float32Array(vertexCount);
  const baseY = new Float32Array(vertexCount);
  const baseZ = new Float32Array(vertexCount);
  const projectedX = new Float32Array(vertexCount);
  const projectedY = new Float32Array(vertexCount);
  const waveSin = new Float32Array(stride);
  const waveCos = new Float32Array(stride);
  const sampleWave = new Float32Array(stride);
  const strandWidth = new Float32Array(strands);
  const colors = Array.from({ length: strands }, (_, i) =>
    i % 5 === 0 ? "rgba(195,237,255,.72)" : `rgba(75,184,246,${.23 + i % 4 * .055})`
  );
  const trailColors = Array.from({ length: 4 }, (_, segment) => `rgba(193,239,255,${.15 + segment * .16})`);

  // Build the tube once. Only its breathing and projection change per frame.
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
    for (let j = 0; j < strands; j++) {
      const u = j / strands * TAU;
      const a = Math.cos(u) * (.23 + .05 * s3);
      const b = Math.sin(u) * (.23 + .05 * s3);
      const index = j * stride + i;
      baseX[index] = (radius * c2 + a * nx + b * bx) * 76;
      baseY[index] = (radius * s2 + a * ny + b * by) * 76;
      baseZ[index] = (.9 * s3 + a * nz + b * bz) * 76;
    }
    // The travelling ripple is sin(3t + phase); keep its sample-dependent half precomputed.
    waveSin[i] = Math.sin(3 * t) * .018;
    waveCos[i] = Math.cos(3 * t) * .018;
  }
  for (let j = 0; j < strands; j++) {
    strandWidth[j] = j % 5 === 0 ? .75 : .45;
  }

  let seed = 7343;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const stars = Array.from({ length: 160 }, () => ({ x: random(), y: random(), radius: .2 + random() * .65, opacity: .06 + random() * .28 }));
  const particles = Array.from({ length: 100 }, () => {
    const angle = random() * TAU;
    return {
      angle,
      sin: Math.sin(angle),
      cos: Math.cos(angle),
      radius: 160 + random() * 160,
      depth: random() * 120 - 60,
      speed: (.035 + random() * .055) * (random() < .5 ? -1 : 1),
      size: .35 + random() * .8,
      opacity: .15 + random() * .5,
    };
  });
  const hatch = Array.from({ length: 240 }, (_, i) => ({ angle: i / 240 * TAU, radius: 272 + random() * 30, length: 4 + random() * 20 }));

  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let scale = 1;
  let centerX = 0;
  let centerY = 0;
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
  let destroyed = false;
  let pointX = 0;
  let pointY = 0;

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

  function draw() {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.drawImage(background, 0, 0);
    // Scroll changes magnification only, from the original view to a 2.5× close-up.
    const renderScale = pixelRatio * scale * (1 + progress * 1.5);
    context.setTransform(renderScale, 0, 0, renderScale, centerX * pixelRatio, centerY * pixelRatio);

    const rx = .92 + Math.sin(time * .26) * .22 + pointerY * .3;
    const ry = -.26 + time * .105 + pointerX * .4;
    const rz = Math.sin(time * .17) * .14;
    const sx = Math.sin(rx), cx = Math.cos(rx);
    const sy = Math.sin(ry), cy = Math.cos(ry);
    const sz = Math.sin(rz), cz = Math.cos(rz);
    const breath = 1 + Math.sin(time * .85) * .027;
    const bob = Math.sin(time * .63) * 7;
    const wavePhase = time * 1.1;
    const waveS = Math.sin(wavePhase);
    const waveC = Math.cos(wavePhase);
    for (let i = 0; i <= samples; i++) sampleWave[i] = waveSin[i] * waveC + waveCos[i] * waveS;
    for (let strand = 0; strand < strands; strand++) {
      const start = strand * stride;
      for (let i = 0; i <= samples; i++) {
        const k = start + i;
        const pulse = breath + sampleWave[i];
        const x = baseX[k] * pulse;
        const y = baseY[k] * pulse;
        const z = baseZ[k] * pulse;
        const yy = y * cx - z * sx;
        const zz = y * sx + z * cx;
        const xx = x * cy + zz * sy;
        const perspective = 900 / (900 - x * sy + zz * cy);
        projectedX[k] = (xx * cz - yy * sz) * perspective;
        projectedY[k] = (xx * sz + yy * cz) * perspective + bob;
      }
    }

    context.globalCompositeOperation = "lighter";
    context.lineJoin = "round";
    // One combined glow pass; sharp filaments are drawn separately on top.
    context.beginPath();
    for (let strand = 0; strand < strands; strand += 3) {
      const start = strand * stride;
      context.moveTo(projectedX[start], projectedY[start]);
      for (let i = 1; i <= samples; i++) context.lineTo(projectedX[start + i], projectedY[start + i]);
    }
    context.strokeStyle = "rgba(45,160,255,.11)";
    context.lineWidth = 4;
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
      context.lineWidth = strandWidth[strand];
      context.stroke();
    }

    // Small, travelling highlights make the surface feel like flowing light, not a rigid wireframe.
    context.lineWidth = .95;
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
      context.arc(pointX, pointY, 1.05, 0, TAU);
      context.fill();
    }

    context.lineWidth = .45;
    context.strokeStyle = "#639cc239";
    context.beginPath();
    context.ellipse(0, 0, 275, 103, -.5 + Math.sin(time * .15) * .13, 0, TAU);
    context.stroke();

    // Twinkle and the doubled angle reuse each particle's own sin/cos.
    const twinkleS = Math.sin(time * .9);
    const twinkleC = Math.cos(time * .9);
    const parallaxX = pointerX * 9;
    const parallaxY = pointerY * 9;
    context.fillStyle = "#b0e4ff";
    for (const particle of particles) {
      const angle = particle.angle + time * particle.speed;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const radius = particle.radius;
      const perspective = 800 / (800 + particle.depth + 160 * sin * cos);
      context.globalAlpha = particle.opacity * (.72 + .28 * (twinkleS * particle.cos + twinkleC * particle.sin));
      context.beginPath();
      context.arc(cos * radius * perspective + parallaxX, sin * radius * .7 * perspective + parallaxY, particle.size, 0, TAU);
      context.fill();
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
      draw();
      return;
    }
    time += dt;
    const follow = 1 - Math.exp(-dt * 4.5);
    pointerX += (targetX - pointerX) * follow;
    pointerY += (targetY - pointerY) * follow;
    progress += (scrollTarget - progress) * (1 - Math.exp(-dt * 5));
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
