#!/usr/bin/env node
/**
 * Genera stats.svg y activity.svg con datos reales de la API GraphQL de GitHub.
 * Lo ejecuta GitHub Actions (ver .github/workflows/profile.yml); no depende de
 * servicios externos que se caen (github-readme-stats, activity-graph, trophies...).
 *
 *   GITHUB_TOKEN=... GH_USER=JsebasGamero node scripts/generate-stats.mjs dist
 *   node scripts/generate-stats.mjs dist --mock     # datos de ejemplo, sin token
 *
 * Repos privados (opcional): si existen STATS_TOKEN (token de solo lectura) y
 * PRIVATE_REPOS ("owner/repo,owner/repo"), sus lenguajes se suman a
 * LANG_DISTRIBUTION. Solo se publican porcentajes por lenguaje, nunca nombres
 * de archivos ni código. Si el token falta o vence, se usan solo repos públicos.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { C, svg, text, tw, n2, defs, glowUser, frame, panelHead } from './theme.mjs';

const args = process.argv.slice(2);
const MOCK = args.includes('--mock');
const OUT = args.find((a) => !a.startsWith('--')) ?? 'dist';
const LOGIN = process.env.GH_USER || process.env.GITHUB_REPOSITORY_OWNER;
const TOKEN = process.env.GITHUB_TOKEN;
const STATS_TOKEN = process.env.STATS_TOKEN;
const PRIVATE_REPOS = (process.env.PRIVATE_REPOS ?? '').split(/[\s,]+/).filter((r) => r.includes('/'));

// Stack con el que más trabajas hoy. Se muestra en TELEMETRÍA como sección propia,
// además de lo que mida LANG_DISTRIBUTION.
// icon: 'csharp' | 'dotnet' | 'azure' | 'generic'
const CORE_STACK = [
  { name: 'C#', sub: 'lenguaje principal', icon: 'csharp' },
  { name: '.NET', sub: 'framework principal', icon: 'dotnet' },
  { name: 'Azure', sub: 'cloud principal', icon: 'azure' },
];

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmt = (n) => n.toLocaleString('en-US');
const fecha = (iso) => (iso ? `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}` : '—');

/* ───────────────────────────── DATOS ───────────────────────────── */
async function gql(query, variables, token = TOKEN) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-stats' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const Q_BASE = `query($login: String!) {
  user(login: $login) {
    login
    createdAt
    followers { totalCount }
    pullRequests { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, orderBy: {field: STARGAZERS, direction: DESC}) {
      totalCount
      nodes {
        nameWithOwner
        stargazerCount
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name } } }
      }
    }
    contributionsCollection {
      contributionYears
      contributionCalendar { totalContributions }
    }
  }
}`;

const Q_REPO_LANGS = `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    languages(first: 10, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name } } }
  }
}`;

/** Lenguajes de los repos privados listados en PRIVATE_REPOS, leídos con STATS_TOKEN. */
async function privateLanguages(seen) {
  const langs = new Map();
  let count = 0;
  if (!PRIVATE_REPOS.length) return { langs, count };
  if (!STATS_TOKEN) {
    console.log('ℹ STATS_TOKEN no está configurado: LANG_DISTRIBUTION usa solo repos públicos.');
    return { langs, count };
  }
  for (const full of PRIVATE_REPOS) {
    if (seen.has(full.toLowerCase())) continue;
    const [owner, name] = full.split('/');
    try {
      const { repository } = await gql(Q_REPO_LANGS, { owner, name }, STATS_TOKEN);
      if (!repository) throw new Error('sin acceso');
      for (const e of repository.languages.edges) langs.set(e.node.name, (langs.get(e.node.name) ?? 0) + e.size);
      count++;
      console.log(`✔ Lenguajes de ${full} incluidos`);
    } catch (err) {
      console.warn(`⚠ No se pudo leer ${full} con STATS_TOKEN (¿token vencido o sin acceso al repo?): ${String(err.message).slice(0, 200)}`);
    }
  }
  return { langs, count };
}

const Q_YEAR = `query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

async function fetchData(login) {
  const { user: u } = await gql(Q_BASE, { login });
  if (!u) throw new Error(`No se encontró el usuario "${login}"`);
  const now = new Date();
  const days = new Map();
  let allTime = 0;
  for (const y of [...u.contributionsCollection.contributionYears].sort()) {
    const from = new Date(Date.UTC(y, 0, 1)).toISOString();
    const to = y === now.getUTCFullYear() ? now.toISOString() : new Date(Date.UTC(y, 11, 31, 23, 59, 59)).toISOString();
    const { user } = await gql(Q_YEAR, { login, from, to });
    const cal = user.contributionsCollection.contributionCalendar;
    allTime += cal.totalContributions;
    for (const w of cal.weeks) for (const d of w.contributionDays) days.set(d.date, d.contributionCount);
  }
  const langs = new Map();
  let stars = 0;
  for (const r of u.repositories.nodes) {
    stars += r.stargazerCount;
    for (const e of r.languages.edges) langs.set(e.node.name, (langs.get(e.node.name) ?? 0) + e.size);
  }
  const priv = await privateLanguages(new Set(u.repositories.nodes.map((r) => r.nameWithOwner.toLowerCase())));
  for (const [name, size] of priv.langs) langs.set(name, (langs.get(name) ?? 0) + size);
  return summarize({
    privateRepos: priv.count,
    login: u.login,
    since: u.createdAt.slice(0, 4),
    allTime,
    lastYear: u.contributionsCollection.contributionCalendar.totalContributions,
    repos: u.repositories.totalCount,
    stars,
    prs: u.pullRequests.totalCount,
    followers: u.followers.totalCount,
    langs,
    days,
    now,
  });
}

function summarize(d) {
  const today = d.now.toISOString().slice(0, 10);
  const series = [...d.days.entries()].filter(([day]) => day <= today).sort(([a], [b]) => (a < b ? -1 : 1));

  // Racha más larga
  let longest = { count: 0, start: null, end: null };
  let run = 0;
  let runStart = null;
  for (const [day, c] of series) {
    if (c > 0) {
      if (run === 0) runStart = day;
      run++;
      if (run > longest.count) longest = { count: run, start: runStart, end: day };
    } else run = 0;
  }
  // Racha actual (si hoy aún no hay contribuciones, la racha sigue viva desde ayer)
  let i = series.length - 1;
  if (i >= 0 && series[i][1] === 0) i--;
  const current = { count: 0, start: null, end: i >= 0 ? series[i][0] : null };
  while (i >= 0 && series[i][1] > 0) {
    current.count++;
    current.start = series[i][0];
    i--;
  }

  const totalBytes = [...d.langs.values()].reduce((a, b) => a + b, 0) || 1;
  const langs = [...d.langs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, size]) => ({ name, pct: (size / totalBytes) * 100 }));

  return { ...d, langs, longest, current, last30: series.slice(-30).map(([date, count]) => ({ date, count })) };
}

function mockData() {
  const now = new Date();
  const days = new Map();
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 400; k >= 0; k--) {
    const d = new Date(now.getTime() - k * 864e5).toISOString().slice(0, 10);
    days.set(d, rnd() < 0.35 ? 0 : Math.floor(rnd() * rnd() * 18) + 1);
  }
  days.set(now.toISOString().slice(0, 10), 3);
  return summarize({
    login: LOGIN ?? 'JsebasGamero',
    since: '2023',
    allTime: 1288,
    lastYear: 542,
    repos: 12,
    stars: 3,
    prs: 27,
    followers: 1,
    // Con PRIVATE_REPOS definido simula que el token pudo leer un repo privado en C#.
    privateRepos: PRIVATE_REPOS.length ? 1 : 0,
    langs: new Map([
      ['JavaScript', 720], ['TypeScript', 140], ['CSS', 70], ['HTML', 45], ['PLpgSQL', 15], ['Shell', 10],
      ...(PRIVATE_REPOS.length ? [['C#', 2600]] : []),
    ]),
    days,
    now,
  });
}

/* ───────────────────────────── STATS.SVG ───────────────────────────── */
function coreIcon(kind, label) {
  const box = `fill="${C.redDeep}" stroke="${C.red}" stroke-width="2.5"`;
  if (kind === 'csharp') {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = ((60 * i - 90) * Math.PI) / 180;
      return `${n2(Math.cos(a) * 24)},${n2(Math.sin(a) * 24)}`;
    }).join(' ');
    return `<polygon points="${pts}" ${box}/>` + text(0, 6, 'C#', { size: 17, weight: 700, fill: C.red, anchor: 'middle' });
  }
  if (kind === 'azure') {
    return `<path transform="translate(-23 -22) scale(1.9)" d="M7 19h10.5a4.5 4.5 0 0 0 .6-8.96A6 6 0 0 0 6.4 9.1 5 5 0 0 0 7 19z" fill="${C.redDeep}" stroke="${C.red}" stroke-width="1.3"/>`;
  }
  const short = kind === 'dotnet' ? '.NET' : label.slice(0, 4).toUpperCase();
  return `<rect x="-22" y="-22" width="44" height="44" rx="9" ${box}/>` + text(0, 5, short, { size: 12, weight: 700, fill: C.red, anchor: 'middle' });
}

function coreStrip(W, top) {
  const n = CORE_STACK.length;
  if (!n) return { svg: '', bottom: top };
  const G = 16, CH = 82, CW = (W - 64 - (n - 1) * G) / n, Y = top + 22;
  let out =
    `<line x1="30" y1="${top - 20}" x2="${W - 30}" y2="${top - 20}" stroke="${C.red}" stroke-opacity=".15"/>` +
    text(32, top + 4, 'CORE_STACK', { size: 12, fill: C.red, weight: 700, ls: 0.2 }) +
    text(32 + tw('CORE_STACK', 12, 0.2) + 14, top + 4, '// lo que más uso hoy en día', { size: 11, fill: C.muted }) +
    text(W - 32, top + 4, `${n} MÓDULOS ACTIVOS`, { size: 11, fill: C.red, anchor: 'end', weight: 700, ls: 0.1 });
  CORE_STACK.forEach((c, i) => {
    const x = 32 + i * (CW + G);
    const base = Y + 66;
    // Ecualizador decorativo (no representa ninguna métrica)
    const SEQ = [6, 22, 10, 18, 8, 20, 6];
    let bars = '';
    for (let b = 0; b < 5; b++) {
      const hs = SEQ.map((_, k) => SEQ[(k + b * 2 + i) % SEQ.length]);
      bars +=
        `<rect x="${n2(x + CW - 84 + b * 12)}" y="${base - hs[0]}" width="6" height="${hs[0]}" fill="${C.red}" opacity=".85">` +
        `<animate attributeName="height" values="${hs.join(';')}" dur="1.4s" repeatCount="indefinite"/>` +
        `<animate attributeName="y" values="${hs.map((h) => base - h).join(';')}" dur="1.4s" repeatCount="indefinite"/></rect>`;
    }
    const act = 'ACTIVE';
    out +=
      `<g opacity="0"><animate attributeName="opacity" from="0" to="1" begin="${n2(0.9 + i * 0.15)}s" dur=".5s" fill="freeze"/>` +
      `<rect x="${n2(x)}" y="${Y}" width="${n2(CW)}" height="${CH}" rx="10" fill="${C.tile}" stroke="${C.red}" stroke-opacity=".55"/>` +
      `<path d="M${n2(x)} ${Y + 22} V${Y + 10} Q${n2(x)} ${Y} ${n2(x + 10)} ${Y} H${n2(x + 22)} M${n2(x + CW)} ${Y + CH - 22} V${Y + CH - 10} Q${n2(x + CW)} ${Y + CH} ${n2(x + CW - 10)} ${Y + CH} H${n2(x + CW - 22)}" fill="none" stroke="${C.red}" stroke-width="2.5"/>` +
      `<g transform="translate(${n2(x + 46)} ${Y + 41})" filter="url(#neonS)">${coreIcon(c.icon, c.name)}</g>` +
      text(x + 88, Y + 40, c.name, { size: 26, weight: 700, fill: C.white, filter: 'neonS' }) +
      text(x + 88, Y + 62, c.sub, { size: 12, fill: C.muted }) +
      `<circle class="blink" cx="${n2(x + CW - 20 - tw(act, 11, 0.15) - 10)}" cy="${Y + 24}" r="4" fill="${C.red}"/>` +
      text(x + CW - 20, Y + 28, act, { size: 11, fill: C.red, weight: 700, anchor: 'end', ls: 0.15 }) +
      bars +
      `</g>`;
  });
  return { svg: out, bottom: Y + CH };
}

function statsSvg(d) {
  const W = 1200;
  const core = coreStrip(W, 450);
  const H = core.bottom + 44;
  const scan = d.now.toISOString().slice(0, 16).replace('T', ' ');

  // Tarjetas
  const tiles = [
    ['CONTRIB_TOTAL', fmt(d.allTime), `desde ${d.since}`],
    ['CONTRIB_365D', fmt(d.lastYear), 'último año'],
    ['RACHA_MAX', `${fmt(d.longest.count)}d`, d.longest.count ? `${fecha(d.longest.start)} → ${fecha(d.longest.end)}` : 'sin datos'],
    ['REPOS', fmt(d.repos), 'públicos propios'],
    ['STARS', fmt(d.stars), 'recibidas'],
    ['PULL_REQUESTS', fmt(d.prs), 'abiertos en total'],
  ];
  const TW = 212, TH = 98, G = 14;
  let tilesSvg = '';
  tiles.forEach(([label, value, sub], i) => {
    const x = 32 + (i % 2) * (TW + G);
    const y = 90 + Math.floor(i / 2) * (TH + G);
    tilesSvg +=
      `<g opacity="0"><animate attributeName="opacity" from="0" to="1" begin="${n2(0.15 * i)}s" dur=".5s" fill="freeze"/>` +
      `<rect x="${x}" y="${y}" width="${TW}" height="${TH}" rx="8" fill="${C.tile}" stroke="${C.red}" stroke-opacity=".16"/>` +
      `<path d="M${x} ${y + 18} V${y + 8} Q${x} ${y} ${x + 8} ${y} H${x + 18}" fill="none" stroke="${C.red}" stroke-width="2"/>` +
      text(x + 16, y + 26, `▸ ${label}`, { size: 11, fill: C.muted, ls: 0.06 }) +
      text(x + 16, y + 66, value, { size: 34, fill: C.red, weight: 700, filter: 'neonS' }) +
      text(x + 16, y + 86, sub, { size: 11, fill: C.muted }) +
      `</g>`;
  });

  // Anillo de racha actual
  const cx = 625, cy = 262, R = 96;
  const pct = d.longest.count ? Math.min(100, (d.current.count / d.longest.count) * 100) : 0;
  let ticks = '';
  for (let i = 0; i < 60; i++) {
    const a = (i * 6 * Math.PI) / 180;
    const r1 = i % 5 === 0 ? 108 : 112;
    ticks += `<line x1="${n2(cx + Math.cos(a) * r1)}" y1="${n2(cy + Math.sin(a) * r1)}" x2="${n2(cx + Math.cos(a) * 117)}" y2="${n2(cy + Math.sin(a) * 117)}" stroke-opacity="${i % 5 === 0 ? 0.9 : 0.3}"/>`;
  }
  const ring =
    text(cx, 104, 'STREAK_CORE', { size: 12, fill: C.red, anchor: 'middle', weight: 700, ls: 0.2 }) +
    `<circle cx="${cx}" cy="${cy}" r="128" fill="none" stroke="${C.red}" stroke-opacity=".4" stroke-dasharray="2 7"><animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="40s" repeatCount="indefinite"/></circle>` +
    `<g stroke="${C.red}" stroke-width="1.5">${ticks}</g>` +
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${C.redDeep}" fill-opacity=".35" stroke="${C.faint}" stroke-width="10"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${C.red}" stroke-width="10" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100" transform="rotate(-90 ${cx} ${cy})" filter="url(#neonS)">` +
    `<animate attributeName="stroke-dasharray" values="0 100;${n2(pct)} 100" dur="1.6s" begin=".3s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".2 .8 .2 1"/></circle>` +
    text(cx, cy + 16, fmt(d.current.count), { size: 56, fill: C.white, weight: 700, anchor: 'middle', filter: 'neon' }) +
    text(cx, cy + 42, 'RACHA ACTUAL', { size: 12, fill: C.red, anchor: 'middle', weight: 700, ls: 0.15 }) +
    text(cx, cy - 46, d.current.count ? `${fecha(d.current.start)} → ${fecha(d.current.end)}` : 'reinicia hoy', { size: 11, fill: C.muted, anchor: 'middle' }) +
    text(cx, 416, `${Math.round(pct)}% DEL RÉCORD (${d.longest.count}d)`, { size: 11, fill: C.muted, anchor: 'middle', ls: 0.08 });

  // Lenguajes
  const LX = 790, LW = W - 32 - LX;
  let langs =
    text(LX, 104, 'LANG_DISTRIBUTION', { size: 12, fill: C.red, weight: 700, ls: 0.2 }) +
    text(LX + LW, 104, `TOP ${d.langs.length} · ${d.privateRepos ? 'PÚBLICOS + PRIVADOS' : 'REPOS PÚBLICOS'}`, { size: 11, fill: C.muted, anchor: 'end' });
  if (!d.langs.length) langs += text(LX, 140, 'sin datos todavía', { size: 13, fill: C.muted });
  d.langs.forEach((l, i) => {
    const y = 140 + i * 46;
    const w = Math.max(4, (l.pct / 100) * LW);
    langs +=
      text(LX, y, l.name, { size: 14, fill: C.text, weight: 700 }) +
      text(LX + LW, y, `${l.pct.toFixed(1)}%`, { size: 13, fill: C.muted, anchor: 'end' }) +
      `<rect x="${LX}" y="${y + 10}" width="${LW}" height="8" rx="4" fill="${C.faint}"/>` +
      `<rect x="${LX}" y="${y + 10}" width="0" height="8" rx="4" fill="url(#lg)"><animate attributeName="width" from="0" to="${n2(w)}" begin="${n2(0.3 + i * 0.12)}s" dur="1s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".2 .8 .2 1"/></rect>`;
  });

  const body = `${defs(`<clipPath id="rd"><rect width="${W}" height="${H}" rx="14"/></clipPath>
<linearGradient id="lg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.redDim}"/><stop offset="1" stop-color="${C.red}"/></linearGradient>`)}
<g clip-path="url(#rd)">
  ${frame(W, H)}
  ${panelHead(W, 'TELEMETRÍA', `// @${d.login}`, `LAST SCAN · ${scan} UTC`)}
  ${tilesSvg}
  ${ring}
  ${langs}
  ${core.svg}
  <path d="M32 ${H - 22} l4 4 l8 -8" fill="none" stroke="${C.red}" stroke-width="2"/>
  ${text(52, H - 17, 'SCAN COMPLETE :: INTEGRITY OK', { size: 11, fill: C.muted, ls: 0.08 })}
  ${text(W - 32, H - 17, 'AUTO-GENERATED BY GITHUB ACTIONS', { size: 11, fill: C.red, anchor: 'end', ls: 0.08 })}
  <rect width="${W}" height="${H}" fill="url(#scan)" opacity=".3"/>
</g>`;
  return svg(W, H, `Estadísticas de GitHub de ${d.login}`, body);
}

/* ───────────────────────────── ACTIVITY.SVG ───────────────────────────── */
function monotonePath(pts) {
  const n = pts.length;
  if (n < 2) return pts.length ? `M${pts[0][0]} ${pts[0][1]}` : '';
  const dx = [], m = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${n2(pts[0][0])} ${n2(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${n2(pts[i][0] + h)} ${n2(pts[i][1] + t[i] * h)} ${n2(pts[i + 1][0] - h)} ${n2(pts[i + 1][1] - t[i + 1] * h)} ${n2(pts[i + 1][0])} ${n2(pts[i + 1][1])}`;
  }
  return d;
}

function activitySvg(d) {
  const W = 1200, H = 310;
  const L = 70, Rt = W - 36, T = 96, B = 254;
  const data = d.last30;
  const total = data.reduce((a, x) => a + x.count, 0);
  const peak = data.reduce((a, x) => (x.count > a.count ? x : a), data[0] ?? { count: 0, date: '' });
  const max = Math.max(4, Math.ceil((peak.count * 1.2) / 4) * 4); // margen sobre el pico
  const X = (i) => L + (i * (Rt - L)) / Math.max(1, data.length - 1);
  const Y = (v) => B - (v / max) * (B - T);
  const pts = data.map((x, i) => [X(i), Y(x.count)]);
  const path = monotonePath(pts);

  let grid = '';
  for (let k = 0; k <= 4; k++) {
    const v = (max / 4) * k;
    const y = Y(v);
    grid += `<line x1="${L}" y1="${n2(y)}" x2="${Rt}" y2="${n2(y)}" stroke="${k ? C.faint : C.red}" stroke-opacity="${k ? 1 : 0.4}" ${k ? 'stroke-dasharray="3 5"' : ''}/>`;
    grid += text(L - 14, y + 4, String(v), { size: 11, fill: C.muted, anchor: 'end' });
  }
  let xl = '';
  data.forEach((x, i) => {
    if (i % 3 === 0 || i === data.length - 1) xl += text(X(i), B + 26, fecha(x.date), { size: 11, fill: C.muted, anchor: 'middle' });
  });
  let dots = '';
  data.forEach((x, i) => {
    const isPeak = x === peak && peak.count > 0;
    dots +=
      `<g opacity="0"><set attributeName="opacity" to="1" begin="${n2(0.2 + (i / data.length) * 1.8)}s" fill="freeze"/>` +
      (isPeak
        ? `<circle cx="${n2(pts[i][0])}" cy="${n2(pts[i][1])}" r="6" fill="${C.red}" filter="url(#neonS)"/>` +
          `<circle cx="${n2(pts[i][0])}" cy="${n2(pts[i][1])}" r="6" fill="none" stroke="${C.red}" stroke-width="2"><animate attributeName="r" values="6;20" dur="1.6s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values="1;0" dur="1.6s" repeatCount="indefinite"/></circle>` +
          text(pts[i][0], pts[i][1] - 16, `PEAK ${peak.count}`, { size: 11, fill: C.white, weight: 700, anchor: 'middle' })
        : `<circle cx="${n2(pts[i][0])}" cy="${n2(pts[i][1])}" r="3.5" fill="${C.panel}" stroke="${C.red}" stroke-width="2"/>`) +
      `</g>`;
  });

  const avg = data.length ? (total / data.length).toFixed(1) : '0';
  const area = pts.length ? `${path} L${n2(Rt)} ${B} L${L} ${B} Z` : '';
  const body = `${defs(`<clipPath id="rd"><rect width="${W}" height="${H}" rx="14"/></clipPath>
${glowUser('lineGlow', W, H, 4)}
<linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.red}" stop-opacity=".38"/><stop offset="1" stop-color="${C.red}" stop-opacity="0"/></linearGradient>`)}
<g clip-path="url(#rd)">
  ${frame(W, H)}
  ${panelHead(W, 'NETWORK ACTIVITY', '// últimos 30 días', `TOTAL ${fmt(total)} · PICO ${peak.count} · MEDIA ${avg}/día`)}
  ${grid}
  <path d="${area}" fill="url(#area)" opacity="0"><animate attributeName="opacity" from="0" to="1" begin=".8s" dur="1.2s" fill="freeze"/></path>
  <path d="${path}" fill="none" stroke="${C.red}" stroke-width="3" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" filter="url(#lineGlow)"><animate attributeName="stroke-dashoffset" from="1" to="0" dur="2s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".4 0 .2 1"/></path>
  ${dots}
  ${xl}
  <rect width="${W}" height="${H}" fill="url(#scan)" opacity=".3"/>
</g>`;
  return svg(W, H, `Actividad de los últimos 30 días de ${d.login}`, body);
}

/* ───────────────────────────── MAIN ───────────────────────────── */
if (!MOCK && (!TOKEN || !LOGIN)) {
  console.error('Faltan GITHUB_TOKEN y/o GH_USER. Usa --mock para probar sin token.');
  process.exit(1);
}
const data = MOCK ? mockData() : await fetchData(LOGIN);
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'stats.svg'), statsSvg(data));
await writeFile(join(OUT, 'activity.svg'), activitySvg(data));
console.log(
  `✔ ${data.login}: ${data.allTime} contribuciones totales, ${data.lastYear} último año, racha ${data.current.count}d (máx ${data.longest.count}d) → ${OUT}/stats.svg, ${OUT}/activity.svg`,
);
