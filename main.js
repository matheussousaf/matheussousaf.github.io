const surface = document.querySelector(".field");
const canvas = surface.querySelector("canvas");
const context = canvas.getContext("2d", { alpha: false });

if (context) {
  const motionButton = document.querySelector(".motion");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const background = document.createElement("canvas");
  const backdrop = background.getContext("2d", { alpha: false });
  const strands = 30;
  const samples = 192;
  const stride = samples + 1;
  const vertexCount = strands * stride;
  const baseX = new Float32Array(vertexCount);
  const baseY = new Float32Array(vertexCount);
  const baseZ = new Float32Array(vertexCount);
  const projectedX = new Float32Array(vertexCount);
  const projectedY = new Float32Array(vertexCount);
  const sampleWave = new Float32Array(stride);
  const strandSpread = new Float32Array(strands);
  const strandSlide = new Float32Array(strands);
  const colors = Array.from({ length: strands }, (_, i) =>
    i % 5 === 0 ? "rgba(195,237,255,.72)" : `rgba(75,184,246,${.23 + i % 4 * .055})`
  );

  // Build the tube once. Only its breathing, displacement and projection change per frame.
  for (let i = 0; i <= samples; i++) {
    const t = i / samples * Math.PI * 2;
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
      const u = j / strands * Math.PI * 2;
      const a = Math.cos(u) * (.23 + .05 * s3);
      const b = Math.sin(u) * (.23 + .05 * s3);
      const index = j * stride + i;
      baseX[index] = (radius * c2 + a * nx + b * bx) * 76;
      baseY[index] = (radius * s2 + a * ny + b * by) * 76;
      baseZ[index] = (.9 * s3 + a * nz + b * bz) * 76;
    }
  }
  for (let j = 0; j < strands; j++) {
    strandSpread[j] = .15 + .09 * Math.sin(j * 2.4);
    strandSlide[j] = Math.sin(j * .8) * 55;
  }

  let seed = 7343;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const stars = Array.from({ length: 160 }, () => ({ x: random(), y: random(), radius: .2 + random() * .65, opacity: .06 + random() * .28 }));
  const particles = Array.from({ length: 100 }, () => ({
    angle: random() * Math.PI * 2,
    radius: 160 + random() * 160,
    depth: random() * 120 - 60,
    speed: (.035 + random() * .055) * (random() < .5 ? -1 : 1),
    size: .35 + random() * .8,
    opacity: .15 + random() * .5,
  }));
  const hatch = Array.from({ length: 240 }, (_, i) => ({ angle: i / 240 * Math.PI * 2, radius: 272 + random() * 30, length: 4 + random() * 20 }));

  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let scale = 1;
  let centerX = 0;
  let centerY = 0;
  let time = 0;
  let lastTime = 0;
  let frame = 0;
  let paused = reducedMotion.matches;
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;
  let energy = 0;
  let ripple = -1;
  let staticDisturbed = false;
  let pressing = false;
  let destroyed = false;

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
    for (const star of stars) {
      backdrop.globalAlpha = star.opacity;
      backdrop.fillStyle = "#91c9ed";
      backdrop.beginPath();
      backdrop.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2);
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

  function resize() {
    const rect = surface.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    if (rect.width === width && rect.height === height && ratio === pixelRatio) return;
    width = rect.width;
    height = rect.height;
    pixelRatio = ratio;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    centerX = width * .5;
    centerY = height * .48;
    scale = Math.min(width / 610, height / 690, 1.3);
    cacheBackground();
    draw();
  }

  function draw() {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.drawImage(background, 0, 0);
    context.setTransform(pixelRatio * scale, 0, 0, pixelRatio * scale, centerX * pixelRatio, centerY * pixelRatio);
    const rx = .92 + Math.sin(time * .26) * .22 + pointerY * .3;
    const ry = -.26 + time * .105 + pointerX * .4;
    const rz = Math.sin(time * .17) * .14;
    const sx = Math.sin(rx), cx = Math.cos(rx);
    const sy = Math.sin(ry), cy = Math.cos(ry);
    const sz = Math.sin(rz), cz = Math.cos(rz);
    const breath = 1 + Math.sin(time * .85) * .027;
    for (let i = 0; i <= samples; i++) sampleWave[i] = Math.sin(i / samples * Math.PI * 6 + time * 1.1) * .018;
    for (let strand = 0; strand < strands; strand++) {
      const expansion = breath + energy * strandSpread[strand];
      const slide = energy * strandSlide[strand];
      for (let i = 0; i <= samples; i++) {
        const k = strand * stride + i;
        const pulse = expansion + sampleWave[i];
        const x = baseX[k] * pulse + slide;
        const y = baseY[k] * pulse;
        const z = baseZ[k] * pulse;
        const yy = y * cx - z * sx;
        const zz = y * sx + z * cx;
        const xx = x * cy + zz * sy;
        const depth = -x * sy + zz * cy;
        const perspective = 900 / (900 + depth);
        projectedX[k] = (xx * cz - yy * sz) * perspective;
        projectedY[k] = (xx * sz + yy * cz) * perspective + Math.sin(time * .63) * 7;
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
    context.lineWidth = 4 + energy * 2;
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
      context.lineWidth = strand % 5 === 0 ? .75 : .45;
      context.stroke();
    }

    // Small, travelling highlights make the surface feel like flowing light, not a rigid wireframe.
    for (let stream = 0; stream < 8; stream++) {
      const strand = (stream * 4) % strands;
      const head = Math.floor(time * (16 + stream * .6) + stream * 23) % samples;
      context.lineWidth = .95;
      for (let segment = 0; segment < 4; segment++) {
        const offset = (head - 20 + segment * 5 + samples) % samples;
        context.beginPath();
        const first = strand * stride + offset;
        context.moveTo(projectedX[first], projectedY[first]);
        for (let step = 1; step <= 5; step++) {
          const index = strand * stride + (offset + step) % samples;
          context.lineTo(projectedX[index], projectedY[index]);
        }
        context.strokeStyle = `rgba(193,239,255,${.15 + segment * .16})`;
        context.stroke();
      }
      const index = strand * stride + head;
      context.fillStyle = "#d9f6ff";
      context.beginPath();
      context.arc(projectedX[index], projectedY[index], 1.05, 0, Math.PI * 2);
      context.fill();
    }

    context.lineWidth = .45;
    context.strokeStyle = "#639cc239";
    context.beginPath();
    context.ellipse(0, 0, 275 + energy * 14, 103, -.5 + Math.sin(time * .15) * .13, 0, Math.PI * 2);
    context.stroke();
    for (const particle of particles) {
      const angle = particle.angle + time * particle.speed;
      const radius = particle.radius + energy * 34;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * .7;
      const z = particle.depth + Math.sin(angle * 2) * 80;
      const perspective = 800 / (800 + z);
      context.globalAlpha = particle.opacity * (.72 + .28 * Math.sin(time * .9 + particle.angle));
      context.fillStyle = "#b0e4ff";
      context.beginPath();
      context.arc(x * perspective + pointerX * 9, y * perspective + pointerY * 9, particle.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    if (ripple >= 0 && ripple < 1) {
      context.strokeStyle = `rgba(109,205,255,${(1 - ripple) * .2})`;
      context.lineWidth = .6;
      context.beginPath();
      context.ellipse(0, 0, 60 + ripple * 305, 40 + ripple * 225, -.3, 0, Math.PI * 2);
      context.stroke();
    }
    context.globalCompositeOperation = "source-over";
  }

  function schedule() {
    if (!frame && !paused && !document.hidden && !destroyed) frame = requestAnimationFrame(animate);
  }
  function animate(now) {
    frame = 0;
    if (paused || document.hidden || destroyed) return;
    // Cap the artwork at 30 fps; do not spend a high-refresh display's entire frame budget.
    if (now - lastTime < 1000 / 30) { schedule(); return; }
    const dt = Math.min((now - lastTime) / 1000, .08);
    lastTime = now;
    time += dt;
    const follow = 1 - Math.exp(-dt * 4.5);
    pointerX += (targetX - pointerX) * follow;
    pointerY += (targetY - pointerY) * follow;
    energy = pressing ? Math.min(1, energy + dt * 1.4) : energy * Math.exp(-dt * 1.7);
    if (ripple >= 0) { ripple += dt * .65; if (ripple > 1) ripple = -1; }
    draw();
    schedule();
  }
  function updateMotion() {
    motionButton.setAttribute("aria-pressed", String(paused));
    motionButton.setAttribute("aria-label", paused ? "Resume animation" : "Pause animation");
    if (paused) { cancelAnimationFrame(frame); frame = 0; pressing = false; }
    else { lastTime = performance.now(); schedule(); }
  }
  function disturb() {
    if (paused) {
      staticDisturbed = !staticDisturbed;
      energy = staticDisturbed ? .8 : 0;
      ripple = -1;
      draw();
      return;
    }
    energy = 1;
    ripple = 0;
    schedule();
  }
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  surface.addEventListener("pointermove", event => {
    if (paused) return;
    const rect = surface.getBoundingClientRect();
    targetX = (event.clientX - rect.left) / width * 2 - 1;
    targetY = (event.clientY - rect.top) / height * 2 - 1;
  }, options);
  surface.addEventListener("pointerleave", () => { targetX = 0; targetY = 0; pressing = false; }, options);
  surface.addEventListener("pointerdown", event => { if (!paused && event.button === 0) pressing = true; }, options);
  window.addEventListener("pointerup", () => { pressing = false; }, options);
  window.addEventListener("pointercancel", () => { pressing = false; }, options);
  surface.addEventListener("click", disturb, options);
  motionButton.addEventListener("click", () => { paused = !paused; updateMotion(); }, options);
  reducedMotion.addEventListener("change", () => {
    paused = reducedMotion.matches;
    targetX = pointerX = targetY = pointerY = 0;
    energy = 0;
    ripple = -1;
    updateMotion();
    draw();
  }, options);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; pressing = false; }
    else { lastTime = performance.now(); schedule(); }
  }, options);
  const observer = new ResizeObserver(resize);
  observer.observe(surface);
  window.addEventListener("resize", resize, options);
  // Preserve back/forward-cache restoration without retaining a live loop off-page.
  window.addEventListener("pagehide", event => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!event.persisted) { destroyed = true; observer.disconnect(); listeners.abort(); }
  }, options);
  window.addEventListener("pageshow", () => { lastTime = performance.now(); schedule(); }, options);
  resize();
  document.querySelector(".still").setAttribute("hidden", "");
  surface.disabled = false;
  motionButton.hidden = false;
  updateMotion();
}
