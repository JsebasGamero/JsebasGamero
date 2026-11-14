#!/usr/bin/env node
/**
 * Genera los SVG estáticos de /assets: encabezado, terminal, certificados,
 * títulos de sección, botones y pie de página.
 *
 * Para cambiar textos: edita PROFILE y ejecuta
 *   node scripts/build-assets.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  C, svg, text, line, tw, len, n2, esc, rng, typed, appear, defs, glowUser, frame, panelHead,
} from './theme.mjs';

const PROFILE = {
  handle: 'JSEBASGAMERO',
  role: 'FULL-STACK DEVELOPER',
  focus: '.NET · AZURE · CYBERSECURITY',
  tagline: 'C# · .NET · Azure · TypeScript · IA agéntica — software seguro del frontend a la nube',
  host: 'jsebas@sec-ops',
  // [clave, valor, nota opcional en rojo]
  neofetch: [
    ['Usuario', 'JsebasGamero'],
    ['Rol', 'Full-Stack Developer'],
    ['Core', 'C# · .NET · Azure', '[ uso diario ]'],
    ['Frontend', 'JavaScript · TypeScript · React · Next.js · Tailwind'],
    ['Backend', '.NET · Node.js · Express · NestJS · REST APIs'],
    ['Datos', 'PostgreSQL · MySQL · MongoDB · Redis · Prisma'],
    ['Cloud', 'Azure · Vercel · Docker'],
    ['DevOps', 'Git · GitHub Actions · Linux'],
    ['IA/Agentes', 'Claude Code · MCP · Skills · Multi-agentes · Harness'],
    ['Seguridad', 'Redes · Linux · SQL · Gestión de riesgos'],
    ['Shell', 'zsh + café + curiosidad infinita'],
    ['Uptime', 'compilando ideas 24/7'],
  ],
  status: [
    'Desarrollando soluciones con C#, .NET y Azure en el día a día',
    'Orquestando agentes de IA: Claude, MCP, skills y multi-agentes',
    'Construyendo aplicaciones web seguras de punta a punta',
    'Formándome en ciberseguridad: redes, Linux, SQL y gestión de riesgos',
    'Abierto a colaborar en proyectos con impacto real',
  ],
  certsIssuer: 'GOOGLE CYBERSECURITY · COURSERA',
  certs: [
    ['Fundamentos de la ciberseguridad', 'Conceptos, roles, ética y marcos de seguridad'],
    ['Ve a lo seguro: Gestiona los riesgos de seguridad', 'Frameworks, controles, SIEM y playbooks'],
    ['Conexión y protección: Redes y seguridad de redes', 'Protocolos, arquitectura de red y hardening'],
    ['Herramientas del oficio: Linux y SQL', 'Bash, permisos, sistema de archivos y consultas SQL'],
    ['Activos, amenazas y vulnerabilidades', 'Clasificación de activos, amenazas y gestión de vulnerabilidades'],
  ],
  ai: {
    orchestrator: 'CLAUDE',
    agents: ['PLANNER', 'CODER', 'REVIEWER', 'TESTER'],
    mcp: ['GITHUB', 'DATABASE', 'BROWSER', 'DOCS'],
    skills: ['skill:spec', 'skill:review', 'skill:tests'],
    capabilities: [
      ['Claude · Claude Code', 'desarrollo agéntico asistido por IA'],
      ['Skills', 'capacidades reutilizables para agentes'],
      ['Multi-agentes', 'orquestadores y subagentes en paralelo'],
      ['MCP', 'agentes conectados a herramientas y datos'],
      ['Harness engineering', 'tools, permisos, hooks y bucle del agente'],
      ['Context engineering', 'prompts, memoria y contexto preciso'],
    ],
  },
  sections: [
    ['whoami', 'WHOAMI', 'ONLINE'],
    ['arsenal', 'ARSENAL', 'LOADED'],
    ['agents', 'AGENTIC ENGINEERING', 'ORCHESTRATING'],
    ['security', 'SECURITY CLEARANCE', 'VERIFIED'],
    ['diagnostics', 'SYSTEM DIAGNOSTICS', 'LIVE'],
    ['snake', 'SNAKE PROTOCOL', 'HUNTING'],
  ],
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets');

const round = (id, w, h, rx = 14) => `<clipPath id="${id}"><rect width="${w}" height="${h}" rx="${rx}"/></clipPath>`;
const shieldPath = 'M0 -50 L42 -34 V0 C42 28 22 44 0 54 C-22 44 -42 28 -42 0 V-34 Z';

/* ───────────────────────────── 3D ─────────────────────────────
 * GitHub no ejecuta JavaScript en el README, así que el 3D se calcula aquí:
 * se rota y proyecta cada vértice y se guardan los fotogramas como animación SVG. */
const n1 = (v) => Math.round(v * 10) / 10;
const rotX = ([x, y, z], a) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
const rotY = ([x, y, z], a) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
const persp = ([x, y, z], D = 6) => [(x * D) / (D - z), (y * D) / (D - z)];

/** Wireframe animado. at(t) devuelve los vértices 2D para t entre 0 y 2π (debe cerrar el ciclo). */
function wire3d({ cx, cy, R, edges, at, frames = 48, dur = 8, width = 1.6, opacity = 1, dots = true, dotR = 2.4 }) {
  const F = Array.from({ length: frames + 1 }, (_, f) => at((f / frames) * 2 * Math.PI));
  const max = Math.max(...F.flat().map(([x, y]) => Math.max(Math.abs(x), Math.abs(y))));
  const s = R / max;
  const P = F.map((pts) => pts.map(([x, y]) => [n1(cx + x * s), n1(cy + y * s)]));
  const d = (pts) => edges.map(([a, b]) => `M${pts[a][0]} ${pts[a][1]}L${pts[b][0]} ${pts[b][1]}`).join('');
  const loop = `dur="${dur}s" repeatCount="indefinite"`;
  let out =
    `<path d="${d(P[0])}" fill="none" stroke="${C.red}" stroke-width="${width}" stroke-opacity="${opacity}" stroke-linecap="round" filter="url(#neonS)">` +
    `<animate attributeName="d" values="${P.map(d).join(';')}" ${loop}/></path>`;
  if (dots) {
    P[0].forEach(([x, y], i) => {
      out +=
        `<circle cx="${x}" cy="${y}" r="${dotR}" fill="#ffd6de">` +
        `<animate attributeName="cx" values="${P.map((p) => p[i][0]).join(';')}" ${loop}/>` +
        `<animate attributeName="cy" values="${P.map((p) => p[i][1]).join(';')}" ${loop}/></circle>`;
    });
  }
  return out;
}

/** Hipercubo 4D: rota en los planos XW e YZ y se proyecta 4D → 3D → 2D. */
function tesseract() {
  const V = Array.from({ length: 16 }, (_, i) => [0, 1, 2, 3].map((b) => ((i >> b) & 1 ? 1 : -1)));
  const edges = [];
  for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) if (i < (i ^ (1 << b))) edges.push([i, i ^ (1 << b)]);
  const at = (t) =>
    V.map(([x, y, z, w]) => {
      const c = Math.cos(t), s = Math.sin(t);
      [x, w] = [x * c - w * s, x * s + w * c];
      [y, z] = [y * c - z * s, y * s + z * c];
      const k = 3 / (3 - w);
      return persp(rotY(rotX([x * k, y * k, z * k], 0.45), 0.6), 9);
    });
  return { edges, at };
}

/** Icosaedro girando; spin debe ser entero para que el ciclo cierre. */
function icosahedron(spin = 1) {
  const g = (1 + Math.sqrt(5)) / 2;
  const V = [[0, 1, g], [0, 1, -g], [0, -1, g], [0, -1, -g], [1, g, 0], [1, -g, 0], [-1, g, 0], [-1, -g, 0], [g, 0, 1], [g, 0, -1], [-g, 0, 1], [-g, 0, -1]];
  const edges = [];
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++) if (Math.abs(V[i].reduce((a, v, k) => a + (v - V[j][k]) ** 2, 0) - 4) < 1e-6) edges.push([i, j]);
  const at = (t) => V.map((v) => persp(rotX(rotY(v, spin * t), 0.5 + 0.25 * Math.sin(t)), 7));
  return { edges, at };
}

/** Globo holográfico con meridianos que giran y un satélite en órbita. */
function globe(cx, cy, R, dur = 10) {
  const frames = 48;
  let out = `<g transform="rotate(-20 ${cx} ${cy})" fill="none" stroke="${C.red}">`;
  out += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${C.redDeep}" fill-opacity=".35" stroke-width="1.8" filter="url(#neonS)"/>`;
  for (const lat of [-60, -30, 0, 30, 60]) {
    const a = (lat * Math.PI) / 180;
    out += `<ellipse cx="${cx}" cy="${n1(cy + R * Math.sin(a))}" rx="${n1(R * Math.cos(a))}" ry="${n1(R * Math.cos(a) * 0.18)}" stroke-opacity=".45"/>`;
  }
  for (let k = 0; k < 6; k++) {
    const vals = Array.from({ length: frames + 1 }, (_, f) => n1(R * Math.abs(Math.sin((k * Math.PI) / 6 + (f / frames) * Math.PI))));
    out += `<ellipse cx="${cx}" cy="${cy}" rx="${vals[0]}" ry="${R}" stroke-opacity=".75"><animate attributeName="rx" values="${vals.join(';')}" dur="${dur}s" repeatCount="indefinite"/></ellipse>`;
  }
  const rx = R * 1.55, ry = R * 0.36;
  const orbit = `M${n1(cx - rx)} ${cy}a${n1(rx)} ${n1(ry)} 0 1 0 ${n1(2 * rx)} 0a${n1(rx)} ${n1(ry)} 0 1 0 ${n1(-2 * rx)} 0`;
  out += `<path d="${orbit}" stroke-opacity=".6" stroke-dasharray="3 5"/>`;
  out += `<circle r="4" fill="#ffd6de" stroke="none" filter="url(#neonS)"><animateMotion path="${orbit}" dur="4s" repeatCount="indefinite"/></circle>`;
  return out + '</g>';
}

/* ───────────────────────────── HEADER ───────────────────────────── */
function header() {
  const W = 1200, H = 380, CX = W / 2, HZ = 306;
  const r = rng(7);
  const GL = '01ABCDEF#$%&*+=<>/\\{}[]?;:';

  // Lluvia de código
  let rain = '';
  for (let x = 16; x < W; x += 30) {
    const n = 10 + Math.floor(r() * 10);
    const dur = n2(5 + r() * 7);
    const delay = n2(-r() * 12);
    const op = n2(0.1 + r() * 0.35);
    let tsp = '';
    for (let i = 0; i < n; i++) {
      const ch = esc(GL[Math.floor(r() * GL.length)]);
      tsp += i === n - 1 ? `<tspan x="${x}" dy="17" fill="#ffd6de">${ch}</tspan>` : `<tspan x="${x}" dy="17">${ch}</tspan>`;
    }
    rain += `<g style="animation:fall ${dur}s linear ${delay}s infinite" opacity="${op}"><text y="${-n * 17}" font-size="14" fill="${C.red}">${tsp}</text></g>`;
  }

  // Piso en perspectiva
  let floorV = '';
  for (let i = -16; i <= 16; i++) floorV += `<line x1="${CX + i * 10}" y1="${HZ}" x2="${CX + i * 110}" y2="${H}"/>`;
  let floorH = '';
  for (let i = 0; i < 5; i++) {
    const b = `${n2(i * 0.6)}s`;
    floorH +=
      `<rect x="0" y="${HZ}" width="${W}" height="1.2" fill="${C.red}" opacity="0">` +
      `<animate attributeName="y" values="${HZ};${H}" keyTimes="0;1" calcMode="spline" keySplines="0.6 0 1 1" dur="3s" begin="${b}" repeatCount="indefinite"/>` +
      `<animate attributeName="opacity" values="0;.75" dur="3s" begin="${b}" repeatCount="indefinite"/></rect>`;
  }

  // Título con glitch
  const T = PROFILE.handle, TY = 200;
  const ta = { size: 84, weight: 700, anchor: 'middle', ls: 0.14 };
  const title =
    `<g class="flick">` +
    `<g class="ga">${text(CX, TY, T, { ...ta, fill: C.red, opacity: 0.9 })}</g>` +
    `<g class="gb">${text(CX, TY, T, { ...ta, fill: '#ffffff', opacity: 0.35 })}</g>` +
    text(CX, TY, T, { ...ta, fill: C.white, filter: 'neon' }) +
    `<g clip-path="url(#sA)"><g class="sa">${text(CX, TY, T, { ...ta, fill: C.red })}</g></g>` +
    `<g clip-path="url(#sB)"><g class="sb">${text(CX, TY, T, { ...ta, fill: '#ffffff' })}</g></g>` +
    `</g>`;

  // Estado de conexión
  const s1 = '[ ESTABLISHING SECURE CONNECTION... ]';
  const s2 = '[ ACCESS GRANTED ]';
  const status =
    `<g>${text(CX, 112, s1, { size: 15, fill: C.muted, anchor: 'middle', ls: 0.1, cls: 'blink' })}<set attributeName="opacity" to="0" begin="1.4s" fill="freeze"/></g>` +
    appear(text(CX, 112, s2, { size: 15, fill: C.red, anchor: 'middle', ls: 0.25, weight: 700, filter: 'neonS' }), 1.4);

  // Subtítulo que se escribe solo
  const sub = `${PROFILE.role}  //  ${PROFILE.focus}`;
  const SS = 22, SLS = 0.16;
  const sx = CX - tw(sub, SS, SLS) / 2;
  const st = typed(sx, 254, sub, { begin: 1.6, cps: 20, size: SS, ls: SLS, weight: 700, fill: C.red, filter: 'neonS', cursor: true });
  const tag = appear(text(CX, 288, PROFILE.tagline, { size: 14, fill: C.muted, anchor: 'middle' }), st.end + 0.2, 0.8);

  // HUD
  const right1 = 'SECURE_LINK :: ESTABLISHED';
  const hud =
    text(30, 40, `SYS://${PROFILE.handle}`, { size: 13, fill: C.red, weight: 700, ls: 0.1 }) +
    text(30, 58, 'PROFILE.EXE :: BUILD 2026.11', { size: 11, fill: C.muted }) +
    `<circle class="blink" cx="${n2(W - 30 - tw(right1, 13, 0.1) - 14)}" cy="35.5" r="5" fill="${C.red}" filter="url(#neonS)"/>` +
    text(W - 30, 40, right1, { size: 13, fill: C.red, weight: 700, anchor: 'end', ls: 0.1 }) +
    text(W - 30, 58, 'ENCRYPTION AES-256 · TLS 1.3', { size: 11, fill: C.muted, anchor: 'end' }) +
    text(30, H - 20, 'NODE 0x4A53 :: AI AGENTS ONLINE :: MCP LINKED', { size: 11, fill: C.muted }) +
    text(W - 30, H - 20, 'STATUS: ONLINE', { size: 12, fill: C.red, weight: 700, anchor: 'end', ls: 0.1, cls: 'blink' });

  const css = `
@keyframes fall{to{transform:translateY(${H + 360}px)}}
.flick{animation:flick 5s steps(1) infinite}
@keyframes flick{0%,42%,44%,88%,91%,100%{opacity:1}43%{opacity:.45}89%{opacity:.25}90%{opacity:.85}}
.ga{animation:ga 3.6s steps(1) infinite}
.gb{animation:gb 3.6s steps(1) infinite}
@keyframes ga{0%,20%,23%,70%,72%,100%{transform:translate(-3px,0)}21%{transform:translate(-9px,2px)}22%{transform:translate(4px,-1px)}71%{transform:translate(-14px,0)}}
@keyframes gb{0%,20%,23%,70%,72%,100%{transform:translate(3px,0)}21%{transform:translate(9px,-2px)}22%{transform:translate(-4px,1px)}71%{transform:translate(14px,1px)}}
.sa{animation:sa 3.6s steps(1) infinite}
.sb{animation:sb 3.6s steps(1) infinite}
@keyframes sa{0%,23%,72%,100%{opacity:0;transform:none}21%{opacity:1;transform:translateX(16px)}22%{opacity:1;transform:translateX(-10px)}71%{opacity:1;transform:translateX(-20px)}}
@keyframes sb{0%,23%,73%,100%{opacity:0;transform:none}21%{opacity:1;transform:translateX(-12px)}22%{opacity:1;transform:translateX(8px)}71%{opacity:1;transform:translateX(22px)}72%{opacity:1;transform:translateX(-6px)}}`;

  const body = `${defs(`
${round('rd', W, H, 16)}
<clipPath id="sA"><rect x="0" y="144" width="${W}" height="11"/></clipPath>
<clipPath id="sB"><rect x="0" y="172" width="${W}" height="9"/></clipPath>
<radialGradient id="hole" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".92"/><stop offset=".7" stop-color="#000" stop-opacity=".6"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<radialGradient id="vig" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></radialGradient>
<linearGradient id="floorV" gradientUnits="userSpaceOnUse" x1="0" y1="${HZ}" x2="0" y2="${H}"><stop offset="0" stop-color="${C.red}" stop-opacity="0"/><stop offset="1" stop-color="${C.red}" stop-opacity=".6"/></linearGradient>
<linearGradient id="bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.red}" stop-opacity="0"/><stop offset=".5" stop-color="${C.red}" stop-opacity=".09"/><stop offset="1" stop-color="${C.red}" stop-opacity="0"/></linearGradient>
<filter id="blur12"><feGaussianBlur stdDeviation="12"/></filter>`)}
<g clip-path="url(#rd)">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <g>${rain}</g>
  <ellipse cx="${CX}" cy="190" rx="560" ry="150" fill="url(#hole)"/>
  ${globe(118, 176, 56)}
  ${text(118, 268, 'NET::GLOBAL_NODE', { size: 10, fill: C.muted, anchor: 'middle', ls: 0.1 })}
  ${wire3d({ cx: W - 118, cy: 176, R: 66, ...tesseract(), dur: 12, width: 1.4 })}
  ${text(W - 118, 268, 'CORE::TESSERACT.4D', { size: 10, fill: C.muted, anchor: 'middle', ls: 0.1 })}
  <ellipse cx="${CX}" cy="${HZ}" rx="520" ry="16" fill="${C.red}" opacity=".28" filter="url(#blur12)"/>
  <g stroke="url(#floorV)" stroke-width="1">${floorV}</g>
  ${floorH}
  <rect x="0" y="${HZ - 1}" width="${W}" height="2" fill="${C.red}" opacity=".85"/>
  ${status}
  ${title}
  ${st.svg}
  ${tag}
  ${hud}
  <rect x="0" y="-120" width="${W}" height="120" fill="url(#bar)"><animate attributeName="y" values="-120;${H}" dur="5s" repeatCount="indefinite"/></rect>
  <rect width="${W}" height="${H}" fill="url(#scan)" opacity=".5"/>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
</g>
${frame(W, H, { rx: 16, fill: 'none' })}`;
  return svg(W, H, `${PROFILE.handle} — ${PROFILE.role} // ${PROFILE.focus}`, body, css);
}

/* ───────────────────────────── TERMINAL ───────────────────────────── */
function emblem() {
  let ticks = '';
  for (let i = 0; i < 72; i++) {
    const a = (i * 5 * Math.PI) / 180;
    const long = i % 6 === 0;
    const r1 = long ? 106 : 112;
    ticks += `<line x1="${n2(Math.cos(a) * r1)}" y1="${n2(Math.sin(a) * r1)}" x2="${n2(Math.cos(a) * 118)}" y2="${n2(Math.sin(a) * 118)}" stroke-opacity="${long ? 0.9 : 0.35}"/>`;
  }
  const hex = (rad) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = ((60 * i - 90) * Math.PI) / 180;
      return `${n2(Math.cos(a) * rad)},${n2(Math.sin(a) * rad)}`;
    }).join(' ');
  const spin = (from, to, dur) =>
    `<animateTransform attributeName="transform" type="rotate" from="${from}" to="${to}" dur="${dur}s" repeatCount="indefinite"/>`;
  return `
  <circle r="134" fill="none" stroke="${C.red}" stroke-opacity=".4" stroke-dasharray="2 7">${spin(0, 360, 40)}</circle>
  <circle r="125" fill="none" stroke="${C.red}" stroke-width="2" stroke-opacity=".85" stroke-dasharray="90 30 20 30 160 50 40 30 120 30">${spin(360, 0, 16)}</circle>
  <g stroke="${C.red}" stroke-width="1.5">${ticks}</g>
  <polygon points="${hex(92)}" fill="${C.redDeep}" fill-opacity=".7"/>
  <path d="M0 0 L0 -118 A118 118 0 0 1 75.85 -90.39 Z" fill="${C.red}" fill-opacity=".16">${spin(0, 360, 4)}</path>
  <polygon points="${hex(92)}" fill="none" stroke="${C.red}" stroke-width="2.5" filter="url(#neonS)"/>
  <polygon points="${hex(80)}" fill="none" stroke="${C.red}" stroke-opacity=".3"/>
  <path d="${shieldPath}" fill="${C.red}" fill-opacity=".12" stroke="${C.red}" stroke-width="2.5" filter="url(#neonS)"/>
  <g fill="${C.red}" filter="url(#neonS)"><circle cy="-8" r="11"/><path d="M-6 -2 L-10 26 H10 L6 -2 Z"/></g>
  <circle r="92" fill="none" stroke="${C.red}" stroke-width="2"><animate attributeName="r" values="92;145" dur="2.6s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values=".7;0" dur="2.6s" repeatCount="indefinite"/></circle>`;
}

function terminal() {
  const P = PROFILE;
  const W = 1200, FS = 17, LH = 28, X = 32, CW = FS * 0.6;
  const promptParts = [[P.host, C.red, 700], [':', C.text], ['~', C.redHot, 700], ['$ ', C.text]];
  const promptW = tw(`${P.host}:~$ `, FS);
  const prompt = (y, at) => appear(line(X, y, promptParts, { size: FS }), at);

  let body = '';
  let t = 0.4;

  // $ neofetch
  let y = 84;
  body += prompt(y, 0);
  const c1 = typed(X + promptW, y, 'neofetch', { begin: t, cps: 12, size: FS });
  body += c1.svg;
  t = c1.end + 0.3;

  // Emblema, centrado verticalmente respecto al bloque de info
  const IX = 430;
  let iy = 128;
  const infoBottom = iy + (P.neofetch.length + 2) * LH;
  const ey = Math.round((iy - 20 + infoBottom) / 2) - 12;
  body += `<g opacity="0" transform="translate(215 ${ey})">${emblem()}<animate attributeName="opacity" from="0" to="1" begin="${n2(t)}s" dur=".8s" fill="freeze"/></g>`;
  body += appear(text(215, ey + 164, '[ CLEARANCE: GRANTED ]', { size: 12, fill: C.red, anchor: 'middle', ls: 0.15, weight: 700 }), t + 0.6);

  // Info estilo neofetch
  const who = `${P.handle.toLowerCase()}@github`;
  body += appear(line(IX, iy, [[P.handle.toLowerCase(), C.red, 700], ['@', C.text], ['github', C.red, 700]], { size: FS }), t);
  iy += LH;
  body += appear(text(IX, iy, '─'.repeat(len(who)), { size: FS, fill: C.redDim }), t + 0.08);
  t += 0.16;
  for (const [k, v, note] of P.neofetch) {
    iy += LH;
    const parts = [[k.padEnd(10), C.red, 700], [': ', C.muted], note ? [v, C.white, 700] : [v, C.text]];
    if (note) parts.push([`  ${note}`, C.red, 700]);
    body += appear(line(IX, iy, parts, { size: FS }), t);
    t += 0.09;
  }
  iy += LH;
  const blocks = ['#1a1a1f', '#2a0009', '#5c0014', '#8a001f', '#c7002d', '#ff003c', '#ff4d6d', '#ffd6de'];
  body += appear(blocks.map((c, i) => `<rect x="${IX + i * 36}" y="${iy - 16}" width="34" height="20" fill="${c}"/>`).join(''), t);
  t += 0.5;

  // $ ./status --now
  y = iy + 52;
  body += prompt(y, t);
  const c2 = typed(X + promptW, y, './status --now', { begin: t + 0.3, cps: 14, size: FS });
  body += c2.svg;
  t = c2.end + 0.25;
  for (const s of P.status) {
    y += LH;
    body += appear(line(X, y, [['[+] ', C.red, 700], [s, C.text]], { size: FS }), t);
    t += 0.18;
  }
  y += LH + 8;
  body += prompt(y, t);
  body += appear(`<rect class="blink" x="${n2(X + promptW)}" y="${y - 15}" width="${n2(CW)}" height="19" fill="${C.red}"/>`, t);
  const H = y + 32;

  const body2 = `${defs(round('rd', W, H))}
<g clip-path="url(#rd)">
  <rect width="${W}" height="${H}" fill="#070709"/>
  <radialGradient id="tg" cx=".15" cy=".1" r=".7"><stop offset="0" stop-color="${C.red}" stop-opacity=".09"/><stop offset="1" stop-color="${C.red}" stop-opacity="0"/></radialGradient>
  <rect width="${W}" height="${H}" fill="url(#tg)"/>
  <rect width="${W}" height="40" fill="#101014"/>
  <line x1="0" y1="40" x2="${W}" y2="40" stroke="${C.red}" stroke-opacity=".25"/>
  <circle cx="26" cy="20" r="6.5" fill="${C.red}"/><circle cx="48" cy="20" r="6.5" fill="${C.redDim}"/><circle cx="70" cy="20" r="6.5" fill="#3a0a12"/>
  ${text(W / 2, 25, `${P.host}: ~/profile — zsh`, { size: 13, fill: C.muted, anchor: 'middle' })}
  ${text(W - 24, 25, '● REC', { size: 12, fill: C.red, anchor: 'end', weight: 700, cls: 'blink' })}
  ${body}
  <rect width="${W}" height="${H}" fill="url(#scan)" opacity=".35"/>
</g>
${frame(W, H, { fill: 'none' })}`;
  return svg(W, H, `${P.host} — neofetch`, body2);
}

/* ───────────────────────────── CERTIFICADOS ───────────────────────────── */
function certs() {
  const P = PROFILE;
  const W = 1200, RH = 62, GAP = 12, Y0 = 90;
  const H = Y0 + P.certs.length * (RH + GAP) + 34;
  let rows = '';
  P.certs.forEach(([name, topic], i) => {
    const y = Y0 + i * (RH + GAP);
    const b = 0.3 + i * 0.25;
    rows += appear(
      `<rect x="30" y="${y}" width="${W - 60}" height="${RH}" rx="8" fill="${C.tile}" stroke="${C.red}" stroke-opacity=".16"/>` +
        `<rect x="30" y="${y + 8}" width="4" height="${RH - 16}" rx="2" fill="${C.red}" filter="url(#neonS)"/>` +
        text(54, y + 38, `[0${i + 1}]`, { size: 15, fill: C.red, weight: 700 }) +
        `<g transform="translate(122 ${y + 31}) scale(.36)"><path d="${shieldPath}" fill="${C.red}" fill-opacity=".15" stroke="${C.red}" stroke-width="5"/><path d="M-18 2 L-5 15 L20 -12" fill="none" stroke="${C.red}" stroke-width="7"/></g>` +
        text(154, y + 27, name, { size: 18, fill: C.white, weight: 700 }) +
        text(154, y + 49, topic, { size: 12, fill: C.muted }) +
        `<rect x="${W - 184}" y="${y + 18}" width="140" height="26" rx="13" fill="${C.red}" fill-opacity=".08" stroke="${C.red}" stroke-opacity=".8"/>` +
        `<path d="M${W - 166} ${y + 31} l4 4 l8 -8" fill="none" stroke="${C.red}" stroke-width="2.2"/>` +
        text(W - 146, y + 36, 'VERIFIED', { size: 12, fill: C.red, weight: 700, ls: 0.18 }) +
        `<rect x="-220" y="${y}" width="200" height="${RH}" fill="url(#sweep)"><animate attributeName="x" from="-220" to="${W}" dur="1.1s" begin="${n2(b)}s" fill="freeze"/></rect>`,
      b,
      0.4,
    );
  });

  const body = `${defs(`${round('rd', W, H)}
<linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.red}" stop-opacity="0"/><stop offset=".8" stop-color="${C.red}" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity=".5"/></linearGradient>`)}
<g clip-path="url(#rd)">
  ${frame(W, H)}
  ${panelHead(W, 'CERTIFICACIONES', '// ciberseguridad', P.certsIssuer)}
  ${rows}
  <rect x="30" y="${Y0 - 6}" width="2" height="${H - Y0 - 22}" fill="${C.red}" opacity=".45" filter="url(#neonS)"><animate attributeName="x" values="30;${W - 32};30" dur="9s" repeatCount="indefinite"/></rect>
  ${text(30, H - 16, `${P.certs.length} MÓDULOS VERIFICADOS :: NIVEL DE ACCESO ELEVADO`, { size: 11, fill: C.muted, ls: 0.08 })}
  ${text(W - 30, H - 16, 'BLUE TEAM // DEFENSE IN DEPTH', { size: 11, fill: C.red, anchor: 'end', ls: 0.08 })}
  <rect width="${W}" height="${H}" fill="url(#scan)" opacity=".3"/>
</g>`;
  return svg(W, H, 'Certificaciones de ciberseguridad', body);
}

/* ───────────────────────────── AGENT MESH (IA) ───────────────────────────── */
function agents() {
  const A = PROFILE.ai;
  const W = 1200, H = 456, OX = 395, OY = 262;
  const ys = [164, 236, 308, 380];
  const LX = 64, RX = 588, NW = 140;
  let edges = '', packets = '', nodes = '';

  const node = (x, y, label, sub, i) =>
    `<rect x="${x}" y="${y - 23}" width="${NW}" height="46" rx="8" fill="${C.tile}" stroke="${C.red}" stroke-opacity=".6"/>` +
    `<circle class="blink" style="animation-delay:${n2(i * 0.27)}s" cx="${x + 16}" cy="${y}" r="4" fill="${C.red}"/>` +
    text(x + 30, y - 2, label, { size: 13, weight: 700, fill: C.white, ls: 0.06 }) +
    text(x + 30, y + 14, sub, { size: 10, fill: C.muted });
  // Conexión con dos paquetes de datos viajando en sentidos opuestos
  const link = (d, i) => {
    edges += `<path d="${d}" fill="none" stroke="${C.red}" stroke-opacity=".35" stroke-width="1.5"/>`;
    packets +=
      `<circle r="3.5" fill="${C.redHot}" filter="url(#neonS)"><animateMotion path="${d}" dur="${n2(2.2 + (i % 4) * 0.35)}s" repeatCount="indefinite"/></circle>` +
      `<circle r="2.5" fill="#ffd6de"><animateMotion path="${d}" dur="${n2(2.8 + (i % 3) * 0.4)}s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear"/></circle>`;
  };
  A.agents.forEach((a, i) => {
    nodes += node(LX, ys[i], a, 'sub-agent', i);
    link(`M${LX + NW} ${ys[i]} C${LX + NW + 66} ${ys[i]} ${OX - 110} ${OY} ${OX - 58} ${OY}`, i);
  });
  A.mcp.forEach((m, i) => {
    nodes += node(RX, ys[i], m, 'mcp server', i + 4);
    link(`M${RX} ${ys[i]} C${RX - 66} ${ys[i]} ${OX + 110} ${OY} ${OX + 58} ${OY}`, i + 4);
  });

  let skills = '';
  A.skills.forEach((s, i) => {
    const cx = OX + (i - 1) * 118;
    skills +=
      `<line x1="${cx}" y1="150" x2="${OX}" y2="${OY - 62}" stroke="${C.red}" stroke-opacity=".35" stroke-dasharray="3 4"/>` +
      `<rect x="${cx - 54}" y="128" width="108" height="22" rx="11" fill="${C.redDeep}" stroke="${C.red}" stroke-opacity=".7"/>` +
      text(cx, 143, s, { size: 11, fill: C.red, weight: 700, anchor: 'middle' });
  });

  // Núcleo: icosaedro 3D con otro interior girando al revés
  const orch =
    `<circle cx="${OX}" cy="${OY}" r="84" fill="none" stroke="${C.red}" stroke-opacity=".35" stroke-dasharray="2 6"><animateTransform attributeName="transform" type="rotate" from="0 ${OX} ${OY}" to="360 ${OX} ${OY}" dur="30s" repeatCount="indefinite"/></circle>` +
    `<circle cx="${OX}" cy="${OY}" r="64" fill="${C.redDeep}" fill-opacity=".5"/>` +
    `<circle cx="${OX}" cy="${OY}" r="64" fill="none" stroke="${C.red}" stroke-width="2"><animate attributeName="r" values="64;100" dur="2.6s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values=".6;0" dur="2.6s" repeatCount="indefinite"/></circle>` +
    wire3d({ cx: OX, cy: OY, R: 54, ...icosahedron(1), dur: 10 }) +
    wire3d({ cx: OX, cy: OY, R: 22, ...icosahedron(-2), dur: 10, width: 1.2, opacity: 0.75, dots: false }) +
    text(OX, OY + 94, A.orchestrator, { size: 16, weight: 700, fill: C.white, anchor: 'middle', ls: 0.2, filter: 'neonS' }) +
    text(OX, OY + 110, 'orchestrator', { size: 10, fill: C.red, anchor: 'middle', ls: 0.15 });

  const CX0 = 790, CWd = W - 30 - CX0, n = A.capabilities.length;
  let caps =
    text(CX0, 112, 'CAPABILITIES', { size: 11, fill: C.red, weight: 700, ls: 0.2 }) +
    text(CX0 + CWd, 112, `${n}/${n} ONLINE`, { size: 11, fill: C.muted, anchor: 'end' });
  A.capabilities.forEach(([name, sub], i) => {
    const y = 128 + i * 50;
    caps += appear(
      `<rect x="${CX0}" y="${y}" width="${CWd}" height="42" rx="6" fill="${C.tile}" stroke="${C.red}" stroke-opacity=".16"/>` +
        `<rect x="${CX0}" y="${y + 8}" width="3" height="26" fill="${C.red}"/>` +
        text(CX0 + 16, y + 26, `0${i + 1}`, { size: 12, fill: C.red, weight: 700 }) +
        text(CX0 + 48, y + 19, name, { size: 15, weight: 700, fill: C.white }) +
        text(CX0 + 48, y + 35, sub, { size: 11, fill: C.muted }) +
        `<circle class="blink" style="animation-delay:${n2(i * 0.2)}s" cx="${CX0 + CWd - 16}" cy="${y + 21}" r="3.5" fill="${C.red}"/>`,
      0.3 + i * 0.15,
      0.4,
    );
  });

  const body = `${defs(round('rd', W, H))}
<g clip-path="url(#rd)">
  ${frame(W, H)}
  ${panelHead(W, 'AGENT MESH', '// desarrollo de software con IA', 'MCP · MULTI-AGENT · HARNESS')}
  <rect x="40" y="88" width="712" height="${H - 118}" rx="14" fill="none" stroke="${C.red}" stroke-opacity=".4" stroke-dasharray="6 6"><animate attributeName="stroke-dashoffset" values="0;-24" dur="1.5s" repeatCount="indefinite"/></rect>
  ${text(58, 112, 'HARNESS', { size: 11, fill: C.red, weight: 700, ls: 0.2 })}
  ${text(58 + tw('HARNESS', 11, 0.2) + 10, 112, ':: tools · permisos · contexto · hooks', { size: 11, fill: C.muted })}
  ${text(LX, 133, 'SUB-AGENTS', { size: 10, fill: C.red, weight: 700, ls: 0.15 })}
  ${text(RX, 133, 'MCP SERVERS', { size: 10, fill: C.red, weight: 700, ls: 0.15 })}
  ${edges}
  ${skills}
  ${orch}
  ${nodes}
  ${packets}
  ${text(OX, 412, 'AGENT LOOP :: plan → code → review → test → ship', { size: 11, fill: C.muted, anchor: 'middle', ls: 0.05 })}
  ${caps}
  <rect width="${W}" height="${H}" fill="url(#scan)" opacity=".3"/>
</g>`;
  return svg(W, H, 'Desarrollo de software con IA: agentes, MCP y harness', body);
}

/* ───────────────────────────── SECCIONES ───────────────────────────── */
function section(n, title, tag) {
  // Fondo oscuro propio: se ve igual con el tema claro u oscuro de GitHub.
  const W = 1200, H = 64, TS = 26, TX = 84;
  const tagStr = `[ ${tag} ]`;
  const lx1 = n2(TX + tw(title, TS, 0.1) + 26);
  const lx2 = n2(W - 22 - tw(tagStr, 12, 0.1) - 18);
  const body = `${defs(`<linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.red}" stop-opacity="0"/><stop offset=".85" stop-color="${C.red}"/><stop offset="1" stop-color="#fff"/></linearGradient>`)}
<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="10" fill="${C.panel}" stroke="${C.red}" stroke-opacity=".25" stroke-width="1.5"/>
<rect x="16" y="17" width="6" height="30" fill="${C.red}" filter="url(#neonS)"/>
${text(34, 41, `//0${n}`, { size: 14, fill: C.muted, weight: 700 })}
${text(TX, 43, title, { size: TS, weight: 700, fill: C.white, ls: 0.1, filter: 'neon' })}
<line x1="${lx1}" y1="33" x2="${lx2}" y2="33" stroke="${C.red}" stroke-opacity=".35"/>
<rect x="${lx1}" y="31.5" width="70" height="3" fill="url(#beam)"><animate attributeName="x" values="${lx1};${n2(lx2 - 70)}" dur="3.5s" repeatCount="indefinite"/></rect>
<circle class="blink" cx="${lx2}" cy="33" r="3.5" fill="${C.red}"/>
${text(W - 22, 38, tagStr, { size: 12, fill: C.red, anchor: 'end', weight: 700, ls: 0.1 })}`;
  return svg(W, H, title, body);
}

/* ───────────────────────────── BOTONES ───────────────────────────── */
function button(label, icon) {
  const W = 300, H = 64;
  const pts = `16,1.5 ${W - 1.5},1.5 ${W - 1.5},${H - 17} ${W - 17},${H - 1.5} 1.5,${H - 1.5} 1.5,16`;
  const body = `${defs(`<clipPath id="bs"><polygon points="${pts}"/></clipPath>
<linearGradient id="shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.red}" stop-opacity="0"/><stop offset=".5" stop-color="${C.red}" stop-opacity=".28"/><stop offset="1" stop-color="${C.red}" stop-opacity="0"/></linearGradient>`)}
<polygon points="${pts}" fill="#09090b" stroke="${C.red}" stroke-width="2"/>
<g clip-path="url(#bs)"><rect x="-160" y="0" width="110" height="${H}" fill="url(#shine)" transform="skewX(-20)"><animate attributeName="x" values="-160;${W + 80}" dur="3.2s" repeatCount="indefinite"/></rect></g>
<g transform="translate(36 32)" filter="url(#neonS)">${icon}</g>
${text(68, 39, label, { size: 19, weight: 700, fill: C.white, ls: 0.14, filter: 'neonS' })}
${text(W - 22, 39, '>>', { size: 16, weight: 700, fill: C.red, anchor: 'end', cls: 'blink' })}`;
  return svg(W, H, label, body);
}

const ICON_LINKEDIN =
  `<rect x="-14" y="-14" width="28" height="28" rx="5" fill="none" stroke="${C.red}" stroke-width="2.2"/>` +
  text(0, 6, 'in', { size: 16, weight: 700, fill: C.red, anchor: 'middle' });
const ICON_EMAIL =
  `<rect x="-15" y="-11" width="30" height="22" rx="3" fill="none" stroke="${C.red}" stroke-width="2.2"/>` +
  `<path d="M-14 -9 L0 2 L14 -9" fill="none" stroke="${C.red}" stroke-width="2.2"/>`;

/* ───────────────────────────── FOOTER ───────────────────────────── */
function footer() {
  const W = 1200, H = 160, BY = 58;
  let d = `M24 ${BY}`;
  for (const bx of [260, 600, 940]) {
    d += ` L${bx} ${BY} L${bx + 14} ${BY - 12} L${bx + 26} ${BY} L${bx + 36} ${BY} L${bx + 46} ${BY + 18} L${bx + 58} ${BY - 44} L${bx + 70} ${BY + 26} L${bx + 82} ${BY} L${bx + 100} ${BY} L${bx + 114} ${BY - 10} L${bx + 128} ${BY}`;
  }
  d += ` L${W - 24} ${BY}`;
  const body = `${defs(glowUser('g', W, H, 4))}
${frame(W, H)}
<path d="${d}" fill="none" stroke="${C.red}" stroke-opacity=".22" stroke-width="2"/>
<path d="${d}" fill="none" stroke="${C.red}" stroke-width="3" stroke-linejoin="round" pathLength="1" stroke-dasharray=".16 .84" filter="url(#g)"><animate attributeName="stroke-dashoffset" values="1;0" dur="2.6s" repeatCount="indefinite"/></path>
${text(W / 2, 116, '// END OF TRANSMISSION', { size: 20, weight: 700, fill: C.white, anchor: 'middle', ls: 0.2, filter: 'neon' })}
${text(W / 2, 142, 'gracias por visitar :: conexión cerrada de forma segura', { size: 12, fill: C.muted, anchor: 'middle', ls: 0.05 })}`;
  return svg(W, H, 'End of transmission', body);
}

/* ───────────────────────────── BUILD ───────────────────────────── */
const files = {
  'header.svg': header(),
  'terminal.svg': terminal(),
  'certs.svg': certs(),
  'agents.svg': agents(),
  'btn-linkedin.svg': button('LINKEDIN', ICON_LINKEDIN),
  'btn-email.svg': button('EMAIL', ICON_EMAIL),
  'footer.svg': footer(),
};
PROFILE.sections.forEach(([file, title, tag], i) => {
  files[`section-${file}.svg`] = section(i + 1, title, tag);
});

await mkdir(OUT, { recursive: true });
for (const [name, content] of Object.entries(files)) {
  await writeFile(join(OUT, name), content);
  console.log(`✔ assets/${name}  (${(content.length / 1024).toFixed(1)} KB)`);
}
