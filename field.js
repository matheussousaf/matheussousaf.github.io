import {
  AddEquation,
  CustomBlending,
  Group,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  OneFactor,
} from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";

const TAU = Math.PI * 2;
const STRANDS = 30;
const SAMPLES = 192;
const UNIT = 76;
// The original canvas pose: tilt about x, then turn about y. It is baked in; the knot never rotates.
const SIN_X = Math.sin(.92), COS_X = Math.cos(.92);
const SIN_Y = Math.sin(-.26), COS_Y = Math.cos(-.26);
// Per segment: premultiplied rgb, filament width (CSS px), sample index, stream id (-1 = none), halo flag.
const STYLE_STRIDE = 7;

// Shared by every field material; FIELD_HALO / FIELD_FLOW defines select the pass.
const vertexDeclarations = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uFocal;
uniform float uCameraZ;
attribute vec4 instanceTint;
attribute vec3 instanceTrack;
varying vec3 vTint;
varying float vHalfWidth;
varying float vQuadHalf;
varying float vSample;
varying float vNear;
#ifdef FIELD_FLOW
  varying float vHead;
#endif

// Canvas line scale: viewport scale, widened up to 40% as the camera travels from z 900 to z 100.
float fieldLineScale() {
  float enter = clamp( ( 900.0 - uCameraZ ) / 800.0, 0.0, 1.0 );
  return uFocal / 900.0 * ( 1.0 + 0.4 * enter );
}

// Quad width in CSS px. Thin passes add one device pixel so the analytic edge fades to zero inside the quad.
float fieldQuadWidth() {
  #if defined( FIELD_HALO )
    return 13.0 * fieldLineScale();
  #elif defined( FIELD_FLOW )
    return 2.1 * fieldLineScale() + 1.0 / uPixelRatio;
  #else
    return 0.75 * fieldLineScale() + 1.0 / uPixelRatio;
  #endif
}
`;

const vertexOutputs = /* glsl */ `
vTint = instanceTint.rgb;
vQuadHalf = 0.5 * fieldQuadWidth() * uPixelRatio;
vHalfWidth = 0.5 * instanceTint.a * fieldLineScale() * uPixelRatio;
vSample = instanceTrack.x + ( position.y < 0.5 ? 0.0 : 1.0 );
// Soften filaments as they reach the near plane instead of letting them pop.
vNear = smoothstep( 24.0, 64.0, - mvPosition.z );
#if defined( FIELD_HALO )
  if ( instanceTrack.z < 0.5 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
#elif defined( FIELD_FLOW )
  float stream = instanceTrack.y;
  vHead = mod( uTime * ( 16.0 + 0.6 * stream ) + 23.0 * stream, 192.0 );
  // Samples from this segment's start back to the head; the segment spans [behind - 1, behind].
  float behind = mod( vHead - instanceTrack.x + 96.0, 192.0 ) - 96.0;
  if ( stream < 0.0 || behind < - 1.0 || behind > 21.5 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
#endif
`;

const fragmentDeclarations = /* glsl */ `
varying vec3 vTint;
varying float vHalfWidth;
varying float vQuadHalf;
varying float vSample;
varying float vNear;
#ifdef FIELD_FLOW
  varying float vHead;
#endif

// Exact coverage of a line of half width h by a one-pixel box filter centred x pixels away.
float fieldCoverage( float x, float h ) {
  return max( 0.0, min( h, x + 0.5 ) - max( - h, x - 0.5 ) );
}
`;

const fragmentShading = /* glsl */ `
// Butt joins: round caps overlap at every joint and would bead under additive blending.
if ( abs( vUv.y ) > 1.0 ) discard;
float across = abs( vUv.x );
#if defined( FIELD_HALO )
  float glow = exp( - 4.5 * across * across ) * ( 1.0 - across * across );
  diffuseColor.rgb *= vec3( 0.176, 0.627, 1.0 ) * 0.17 * glow;
#elif defined( FIELD_FLOW )
  float x = across * vQuadHalf;
  float beadHalf = vQuadHalf - 0.5;
  float behind = mod( vHead - vSample + 96.0, 192.0 ) - 96.0;
  float trail = step( 0.0, behind ) * mix( 0.63, 0.15, clamp( behind / 20.0, 0.0, 1.0 ) ) * ( 1.0 - smoothstep( 17.0, 21.0, behind ) );
  float bead = exp( - 8.0 * behind * behind );
  diffuseColor.rgb *= vec3( 0.757, 0.937, 1.0 ) * trail * fieldCoverage( x, beadHalf * 0.452 )
    + vec3( 0.851, 0.965, 1.0 ) * bead * fieldCoverage( x, beadHalf );
#else
  diffuseColor.rgb *= vTint * fieldCoverage( across * vQuadHalf, vHalfWidth );
#endif
diffuseColor.rgb *= vNear;
// Premultiplied output: alpha tracks the brightest channel, so the canvas stays valid to composite.
alpha = max( max( diffuseColor.r, diffuseColor.g ), diffuseColor.b );
`;

function inject(source, token, code) {
  if (!source.includes(token)) throw new Error(`field: LineMaterial shader no longer contains ${token}`);
  return source.replace(token, code);
}

// Extends the official LineMaterial shader in place, keeping its screen-space quads and near-plane trimming.
function extendLineShader(shader) {
  let vertex = shader.vertexShader;
  vertex = inject(vertex, "#include <clipping_planes_pars_vertex>", `#include <clipping_planes_pars_vertex>\n${vertexDeclarations}`);
  vertex = inject(vertex, "offset *= linewidth;", "offset *= fieldQuadWidth();");
  vertex = inject(vertex, "#include <fog_vertex>", `#include <fog_vertex>\n${vertexOutputs}`);
  shader.vertexShader = vertex;

  let fragment = shader.fragmentShader;
  fragment = inject(fragment, "#include <clipping_planes_pars_fragment>", `#include <clipping_planes_pars_fragment>\n${fragmentDeclarations}`);
  fragment = inject(fragment, "#include <color_fragment>", `#include <color_fragment>\n${fragmentShading}`);
  // Display-referred values, added like the canvas "lighter" composite.
  fragment = inject(fragment, "#include <colorspace_fragment>", "");
  shader.fragmentShader = fragment;
}

function buildGeometry() {
  const stride = SAMPLES + 1;
  const points = new Float32Array(STRANDS * stride * 3);
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES * TAU;
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
    const cx = radius * c2 * UNIT;
    const cy = radius * s2 * UNIT;
    const cz = .9 * s3 * UNIT;
    const tube = (.23 + .05 * s3) * UNIT;
    for (let j = 0; j < STRANDS; j++) {
      const u = j / STRANDS * TAU;
      const a = Math.cos(u) * tube;
      const b = Math.sin(u) * tube;
      const x = cx + a * nx + b * bx;
      const y = cy + a * ny + b * by;
      const z = cz + a * nz + b * bz;
      const yy = y * COS_X - z * SIN_X;
      const zz = y * SIN_X + z * COS_X;
      const k = (j * stride + i) * 3;
      points[k] = x * COS_Y + zz * SIN_Y;
      points[k + 1] = -yy; // Canvas y pointed down; Three's y points up.
      points[k + 2] = zz * COS_Y - x * SIN_Y;
    }
  }

  const segments = new Float32Array(STRANDS * SAMPLES * 6);
  const style = new Float32Array(STRANDS * SAMPLES * STYLE_STRIDE);
  for (let j = 0; j < STRANDS; j++) {
    const bright = j % 5 === 0;
    const alpha = bright ? .72 : .23 + j % 4 * .055;
    const red = (bright ? 195 : 75) / 255 * alpha;
    const green = (bright ? 237 : 184) / 255 * alpha;
    const blue = (bright ? 255 : 246) / 255 * alpha;
    const width = bright ? .75 : .45;
    const stream = j % 4 === 0 ? j / 4 : -1;
    const halo = j % 3 === 0 ? 1 : 0;
    for (let i = 0; i < SAMPLES; i++) {
      const n = j * SAMPLES + i;
      // Strand points are contiguous, so a segment is the 6 floats starting at its first sample.
      const k = (j * stride + i) * 3;
      for (let c = 0; c < 6; c++) segments[n * 6 + c] = points[k + c];
      const s = n * STYLE_STRIDE;
      style[s] = red;
      style[s + 1] = green;
      style[s + 2] = blue;
      style[s + 3] = width;
      style[s + 4] = i;
      style[s + 5] = stream;
      style[s + 6] = halo;
    }
  }

  const geometry = new LineSegmentsGeometry().setPositions(segments);
  const styleBuffer = new InstancedInterleavedBuffer(style, STYLE_STRIDE, 1);
  geometry.setAttribute("instanceTint", new InterleavedBufferAttribute(styleBuffer, 4, 0));
  geometry.setAttribute("instanceTrack", new InterleavedBufferAttribute(styleBuffer, 3, 4));
  return geometry;
}

function createMaterial(pass, uniforms) {
  const material = new LineMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    // Pure additive premultiplied light over the transparent canvas and CSS backdrop.
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
  });
  if (pass) material.defines[pass] = "";
  material.uniforms.uTime = uniforms.uTime;
  material.uniforms.uPixelRatio = uniforms.uPixelRatio;
  material.uniforms.uFocal = uniforms.uFocal;
  material.uniforms.uCameraZ = uniforms.uCameraZ;
  material.onBeforeCompile = extendLineShader;
  return material;
}

/**
 * The fixed torus-knot forcefield: 30 strands × 192 segments sharing one immutable instanced geometry,
 * drawn as a soft halo, crisp filament cores and GPU-animated flowing highlights (3 draw calls).
 */
export function createField(uniforms) {
  const geometry = buildGeometry();
  const field = new Group();
  field.name = "field";
  for (const [name, pass] of [["field-halo", "FIELD_HALO"], ["field-core", ""], ["field-flow", "FIELD_FLOW"]]) {
    const lines = new LineSegments2(geometry, createMaterial(pass, uniforms));
    lines.name = name;
    field.add(lines);
  }
  return field;
}
