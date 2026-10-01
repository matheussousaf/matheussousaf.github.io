import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
} from "three";

// Allocated once; the parent draws a viewport-sized prefix via geometry.setDrawRange.
// Every particle is independently random, so any prefix is a uniform sample of the cloud.
export const PARTICLE_CAPACITY = 4096;

const RADIUS = 480;
const NEAR = 40; // camera distance where a mote has fully faded and wraps to the back
const RANGE = 1800; // depth band recycled in front of the camera

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uFocal;
  uniform float uCameraZ;

  attribute vec4 aMotion; // size, speed, brightness, phase

  varying float vAlpha;
  varying float vCore;
  varying float vPixel;

  const float NEAR = ${NEAR.toFixed(1)};
  const float RANGE = ${RANGE.toFixed(1)};

  void main() {
    // position.z is a depth offset, not a coordinate. Distance to the camera shrinks as the
    // camera advances (scroll) and, slowly, as each mote drifts toward the viewer, then wraps.
    float depth = NEAR + mod(position.z + uCameraZ - uTime * aMotion.y, RANGE);
    vec4 mvPosition = modelViewMatrix * vec4(position.xy, uCameraZ - depth, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Fades at both ends of the band hide the wrap: a mote leaves invisible and returns invisible.
    float fade = smoothstep(NEAR, NEAR + 150.0, depth)
      * (1.0 - smoothstep(NEAR + RANGE - 460.0, NEAR + RANGE, depth));

    // Softened perspective keeps distant motes legible and near ones from ballooning.
    float diameter = aMotion.x * 5.0 * sqrt(uFocal / depth);
    float shown = clamp(diameter, 1.6, 12.0);
    float size = min(shown * uPixelRatio, 24.0);
    // Points held at the minimum size give up brightness instead of growing heavier.
    float energy = min(1.0, (diameter * diameter) / (shown * shown));

    float twinkle = 0.74 + 0.26 * sin(uTime * (0.55 + 0.8 * fract(aMotion.w * 7.13)) + aMotion.w * 6.2832);
    vAlpha = aMotion.z * fade * twinkle * energy;
    // A sharp core about one CSS pixel wide, expressed in sprite radius units.
    vPixel = 2.0 / size;
    vCore = clamp((0.45 + 0.5 * aMotion.z) * uPixelRatio * vPixel, 0.1, 0.85);
    gl_PointSize = size;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying float vCore;
  varying float vPixel;

  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0 || vAlpha < 0.002) discard;

    float core = 1.0 - smoothstep(vCore - vPixel, vCore + vPixel, r);
    float falloff = 1.0 - r;
    float halo = falloff * falloff * (0.18 + 0.4 * falloff);
    vec3 color = mix(vec3(0.27, 0.65, 0.96), vec3(0.89, 0.97, 1.0), max(core, falloff * falloff * 0.6));

    gl_FragColor = vec4(color, vAlpha * (core + halo * (1.0 - core)));
  }
`;

// Deterministic so the field looks identical across loads and under reduced motion.
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createParticles(uniforms) {
  const random = mulberry32(7343);
  const positions = new Float32Array(PARTICLE_CAPACITY * 3);
  const motion = new Float32Array(PARTICLE_CAPACITY * 4);

  for (let i = 0; i < PARTICLE_CAPACITY; i++) {
    // Uniform over the disc, centre included: the camera flies into the cloud, nothing parts.
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * RADIUS;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.sin(angle) * radius;
    positions[i * 3 + 2] = random() * RANGE;

    // Most motes stay faint; roughly one in sixteen is a brighter, slightly larger spark.
    const bright = random() < 0.06;
    motion[i * 4] = bright ? 1.25 + random() * 0.55 : 0.65 + random() * 0.75;
    motion[i * 4 + 1] = 4 + random() * 9;
    motion[i * 4 + 2] = bright ? 0.62 + random() * 0.3 : 0.12 + random() * 0.26;
    motion[i * 4 + 3] = random();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aMotion", new Float32BufferAttribute(motion, 4));

  const material = new ShaderMaterial({
    // The parent's uniform objects themselves, so its per-frame writes reach the shader.
    uniforms: {
      uTime: uniforms.uTime,
      uPixelRatio: uniforms.uPixelRatio,
      uFocal: uniforms.uFocal,
      uCameraZ: uniforms.uCameraZ,
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const points = new Points(geometry, material);
  points.name = "particles";
  // Depth is resolved on the GPU; CPU bounds from the raw attribute would cull wrongly.
  points.frustumCulled = false;
  return points;
}
