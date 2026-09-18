/** Fragment shader for the hero's airflow field: a warped grid of hairlines
 *  with one green isoline running through it. Drawn on a single full-screen
 *  triangle — there is no geometry to upload and nothing to garbage collect. */
export const VECTOR_FIELD_FRAGMENT = /* glsl */ `
precision mediump float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uInk;
uniform vec3 uSignal;
varying vec2 vUv;

/** Cheap flow: two rotated sine bands, so the grid breathes instead of sliding. */
float flow(vec2 p, float t) {
  float a = sin(p.x * 2.4 + t * 0.22) * 0.34;
  float b = sin((p.x * 1.1 + p.y * 1.9) - t * 0.17) * 0.22;
  return a + b;
}

/**
 * Anti-aliased line at every integer crossing of v. fwidth() would be the
 * obvious way to size the feather, but it needs an extension on WebGL1, so the
 * width is passed in from the caller instead and this stays portable.
 */
float grid(float v, float feather) {
  float d = abs(fract(v - 0.5) - 0.5);
  return 1.0 - smoothstep(0.0, feather, d);
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0) * 2.4;
  float warp = flow(p, uTime);

  // One pixel in the same units as p, so lines stay hairline at any size.
  float feather = 2.4 / uResolution.y * 1.8;
  float rows = grid((p.y + warp) * 4.5, feather * 4.5);
  float cols = grid(p.x * 4.5, feather * 4.5) * 0.4;
  float lines = max(rows, cols);

  // Fade toward the edges so the field sits in the page rather than on it.
  float vignette = smoothstep(2.1, 0.15, length(p * vec2(0.5, 0.8)));
  float ink = lines * vignette * 0.34;

  // The signal colour rides the existing hairlines where the flow peaks, so it
  // reads as a traced line rather than a smudge of colour behind the type.
  float crest = smoothstep(0.24, 0.33, warp) * (1.0 - smoothstep(0.33, 0.42, warp));
  float signal = rows * crest * vignette;

  vec3 colour = mix(uInk, uSignal, clamp(signal * 1.6, 0.0, 1.0));
  gl_FragColor = vec4(colour, clamp(ink + signal * 0.45, 0.0, 1.0));
}
`;

export const VECTOR_FIELD_VERTEX = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;
