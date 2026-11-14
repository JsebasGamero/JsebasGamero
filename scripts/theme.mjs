// Paleta y utilidades compartidas por los generadores de SVG del perfil.
// Todo el texto usa una fuente monoespaciada y `textLength`, así se ve igual
// en Windows, macOS y Linux aunque cada sistema tenga una fuente distinta.

export const C = {
  bg: '#050506',
  panel: '#08080a',
  tile: '#0e0e12',
  red: '#ff003c',
  redHot: '#ff4d6d',
  redMid: '#c7002d',
  redDim: '#8a001f',
  redDeep: '#2a0009',
  white: '#f5f5f7',
  text: '#e6e6ec',
  muted: '#8b8b97',
  faint: '#1f1f26',
};

export const FONT =
  "'JetBrains Mono','Fira Code','SF Mono','Cascadia Code',Menlo,Consolas,'DejaVu Sans Mono','Liberation Mono','Courier New',monospace";

const ADV = 0.6; // ancho de cada carácter, en em

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const len = (s) => [...String(s)].length;
export const n2 = (v) => Math.round(v * 100) / 100;
/** Ancho que ocupará un texto (size en px, ls = espaciado extra en em). */
export const tw = (s, size, ls = 0) => len(s) * size * (ADV + ls);

/** <text> monoespaciado con ancho fijo. */
export function text(x, y, str, o = {}) {
  const { size = 16, fill = C.text, weight, anchor, opacity, cls, filter, ls = 0, style } = o;
  const a = [`x="${n2(x)}"`, `y="${n2(y)}"`, `font-size="${size}"`, `fill="${fill}"`];
  if (weight) a.push(`font-weight="${weight}"`);
  if (anchor) a.push(`text-anchor="${anchor}"`);
  if (opacity != null) a.push(`opacity="${opacity}"`);
  if (cls) a.push(`class="${cls}"`);
  if (filter) a.push(`filter="url(#${filter})"`);
  if (style) a.push(`style="${style}"`);
  if (len(str) > 1) a.push(`textLength="${n2(tw(str, size, ls))}" lengthAdjust="spacing"`);
  return `<text xml:space="preserve" ${a.join(' ')}>${esc(str)}</text>`;
}

/** Una línea con varios colores: parts = [[texto, color, peso?], ...] */
export function line(x, y, parts, o = {}) {
  const size = o.size ?? 16;
  let cx = x;
  let out = '';
  for (const [str, fill, weight] of parts) {
    const lead = str.length - str.trimStart().length;
    const core = str.trim();
    if (core) out += text(cx + lead * size * ADV, y, core, { ...o, size, fill, weight });
    cx += tw(str, size);
  }
  return out;
}

/** Generador pseudoaleatorio con semilla (mismo resultado en cada build). */
export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let uid = 0;
/** Texto que se "escribe" letra por letra. Devuelve { svg, end }. */
export function typed(x, y, str, o = {}) {
  const { begin = 0, cps = 16, size = 16, ls = 0, cursor = false, cursorColor = C.red } = o;
  const id = `ty${uid++}`;
  const n = len(str);
  const step = size * (ADV + ls);
  const dur = n / cps;
  const widths = Array.from({ length: n + 1 }, (_, i) => n2(i * step)).join(';');
  const xs = Array.from({ length: n + 1 }, (_, i) => n2(x + i * step)).join(';');
  const anim = (attr, values) =>
    `<animate attributeName="${attr}" values="${values}" calcMode="discrete" begin="${n2(begin)}s" dur="${n2(dur)}s" fill="freeze"/>`;
  let svg = `<clipPath id="${id}"><rect x="${n2(x)}" y="${n2(y - size * 1.1)}" width="0" height="${n2(size * 1.6)}">${anim('width', widths)}</rect></clipPath>`;
  svg += `<g clip-path="url(#${id})">${text(x, y, str, o)}</g>`;
  if (cursor) {
    // El grupo controla cuándo aparece; el rect parpadea por CSS.
    svg += `<g opacity="0"><set attributeName="opacity" to="1" begin="${n2(begin)}s" fill="freeze"/>`;
    svg += `<rect class="blink" x="${n2(x)}" y="${n2(y - size * 0.85)}" width="${n2(size * 0.55)}" height="${n2(size)}" fill="${cursorColor}">${anim('x', xs)}</rect></g>`;
  }
  return { svg, end: begin + dur };
}

/** Hace visible un bloque en un instante dado (con fundido opcional). */
export const appear = (inner, at, fade = 0) =>
  fade
    ? `<g opacity="0">${inner}<animate attributeName="opacity" from="0" to="1" begin="${n2(at)}s" dur="${fade}s" fill="freeze"/></g>`
    : `<g opacity="0">${inner}<set attributeName="opacity" to="1" begin="${n2(at)}s" fill="freeze"/></g>`;

/** Filtros de brillo neón y patrón de scanlines. */
export function defs(extra = '') {
  const glow = (id, std, op) =>
    `<filter id="${id}" x="-25%" y="-80%" width="150%" height="260%" color-interpolation-filters="sRGB">` +
    `<feGaussianBlur in="SourceAlpha" stdDeviation="${std}" result="b"/>` +
    `<feFlood flood-color="${C.red}" flood-opacity="${op}"/><feComposite in2="b" operator="in" result="g"/>` +
    `<feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  return `<defs>
${glow('neon', 7, 0.8)}
${glow('neonS', 3, 0.9)}
<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity=".5"/></pattern>
${extra}
</defs>`;
}

/** Filtro de brillo en coordenadas absolutas (para líneas que pueden ser planas). */
export const glowUser = (id, w, h, std = 4) =>
  `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" color-interpolation-filters="sRGB">` +
  `<feGaussianBlur stdDeviation="${std}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

/** Panel con borde y esquinas tipo HUD. */
export function frame(w, h, { rx = 14, fill = C.panel } = {}) {
  const L = 20;
  const o = 7;
  const c = (x, y, dx, dy) => `M${x} ${y + dy * L}V${y}H${x + dx * L}`;
  return (
    `<rect x=".75" y=".75" width="${w - 1.5}" height="${h - 1.5}" rx="${rx}" fill="${fill}" stroke="${C.red}" stroke-opacity=".3" stroke-width="1.5"/>` +
    `<path d="${c(o, o, 1, 1)}${c(w - o, o, -1, 1)}${c(o, h - o, 1, -1)}${c(w - o, h - o, -1, -1)}" fill="none" stroke="${C.red}" stroke-width="2.5"/>`
  );
}

/** Encabezado de panel: triángulo + título + subtítulo + texto a la derecha. */
export function panelHead(w, title, sub, right) {
  const tx = 52;
  return (
    `<path d="M30 49 L44 35 V49 Z" fill="${C.red}" filter="url(#neonS)"/>` +
    text(tx, 48, title, { size: 20, weight: 700, fill: C.white, ls: 0.08 }) +
    (sub ? text(tx + tw(title, 20, 0.08) + 16, 48, sub, { size: 14, fill: C.muted }) : '') +
    (right ? text(w - 32, 47, right, { size: 12, fill: C.red, anchor: 'end', weight: 700, ls: 0.08 }) : '') +
    `<line x1="30" y1="68" x2="${w - 30}" y2="68" stroke="${C.red}" stroke-opacity=".25"/>`
  );
}

export const BASE_CSS = `
text{white-space:pre}
.blink{animation:blink 1.1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;

export function svg(w, h, title, body, css = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title" font-family="${FONT}">
<title id="title">${esc(title)}</title>
<style>${BASE_CSS}
${css}</style>
${body}
</svg>
`;
}
