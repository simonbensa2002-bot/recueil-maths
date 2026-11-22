/* Recueil de mathématiques : appli hors-ligne (Spé + Expertes, M. Hattab) */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const LV = ['', 'Échauffement', 'Scolaire', 'Contrôle', 'Exigeant', 'Défi'];
const LVD = ['', 'Techniques de base, très guidé', 'Exercices guidés, cours appliqué', 'Niveau contrôle de M. Hattab', 'Niveau DST ou bac, peu guidé', 'Étoilé, concours, prépa'];
const KIND = { ds: 'DS', dt: 'DT', dm: 'Devoir maison', bb: 'Bac blanc', ic: 'Interrogation', td: 'TD', exo: 'Exercice', arch: 'Archive', hp: 'Hors programme', rev: 'Révision' };
const FEEL = [['Facile', -1], ['Normal', 0], ['Difficile', 1], ['Très dur', 2]];
const STATUS = ['Pas encore vu', 'Vu en classe', 'Révisé', 'Maîtrisé'];
const SCOL = ['--st0', '--st1', '--st2', '--st3'];

/* ---------- état ---------- */
const KEY = 'recueil-v2';
const DEF = { sel: [], lv: 3, max: 0, calc: 'any', cor: false, more: false, hideDone: false, st: {}, done: {}, lib: { tr: 'all', k: 'all', q: '' } };
let S;
try { S = Object.assign(JSON.parse(JSON.stringify(DEF)), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = JSON.parse(JSON.stringify(DEF)); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };
const chState = id => (S.st[id] = S.st[id] || { st: 0, rev: false });

/* ---------- PDF stockés dans le téléphone (IndexedDB) ---------- */
const idb = () => new Promise((res, rej) => {
  const r = indexedDB.open('recueil', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('pdfs');
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const idbOp = (mode, fn) => idb().then(db => new Promise((res, rej) => {
  const t = db.transaction('pdfs', mode), st = t.objectStore('pdfs'), q = fn(st);
  t.oncomplete = () => res(q ? q.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
}));
const idbGet = k => idbOp('readonly', s => s.get(k)).catch(() => null);
const idbPut = (k, v) => idbOp('readwrite', s => s.put(v, k));
const idbKeys = () => idbOp('readonly', s => s.getAllKeys()).catch(() => []);
const idbClear = () => idbOp('readwrite', s => s.clear());

let DATA = null, HAVE = new Set();
const allSlugs = () => {
  const s = new Set();
  DATA.docs.forEach(d => { s.add(d.pdf); if (d.cor && d.cor !== 'inclus') s.add(d.cor); });
  DATA.cours.forEach(c => { s.add(c.cours); if (c.fiche) s.add(c.fiche); });
  DATA.niches.forEach(n => s.add(n.pdf));
  return [...s];
};

/* ---------- difficulté et score ---------- */
const doneOf = d => S.done[d.id];
const adjLv = d => { const x = doneOf(d); return x && x.dl != null ? clamp(d.lv + x.dl, 1, 5) : d.lv; };
function score(d) {
  const sel = new Set(S.sel), tg = new Set(d.tags);
  const hit = [...sel].filter(t => tg.has(t)), cov = sel.size ? hit.length / sel.size : 0;
  const prec = tg.size ? hit.length / tg.size : 0;
  const fit = 1 - Math.abs(adjLv(d) - S.lv) / 4;
  const v = sel.size ? .6 * cov + .15 * prec + .25 * fit : fit;
  return { s: Math.round(v * 100), hit, cov };
}
function pool() {
  return DATA.docs.filter(d => {
    if (!S.more && ['td', 'arch', 'rev', 'hp'].includes(d.k)) return false;
    if (S.max && d.min && d.min > S.max) return false;
    if (S.calc === 'no' && d.calc === true) return false;
    if (S.calc === 'yes' && d.calc === false) return false;
    if (S.cor && !d.cor) return false;
    if (S.hideDone && doneOf(d)) return false;
    return true;
  });
}
const durTxt = m => !m ? '' : m >= 60 ? (Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + String(m % 60).padStart(2, '0') : '')) : m + ' min';
const dots = (n, cls = '') => `<span class="dots ${cls}" aria-label="Niveau ${n} sur 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
const tagName = id => (DATA.tags.find(t => t.id === id) || { t: id === 'geo-plane' ? 'Géométrie plane' : id }).t;

/* ---------- carte d'un DS ---------- */
const OPEN = new Set();
function card(d, sc) {
  const x = doneOf(d), adj = adjLv(d), sel = new Set(S.sel);
  const hasCor = d.cor && d.cor !== 'inclus';
  const ring = sc ? `<div class="ring" style="--p:${sc.s};--c:${sc.s >= 75 ? '#34d27b' : sc.s >= 50 ? '#7b4dff' : '#ffb340'}" aria-label="Correspondance ${sc.s} pour cent"><span>${sc.s}</span></div>` : '';
  const tags = d.tags.map(t => `<span class="chip tiny ${sel.size ? (sel.has(t) ? 'hit' : 'miss') : ''}">${esc(tagName(t))}</span>`).join('');
  const meta = [
    `<span>${dots(d.lv)} ${LV[d.lv]}</span>`,
    adj !== d.lv ? `<span>${dots(adj, 'adj')} pour toi : ${LV[adj]}</span>` : '',
    d.min ? `<span>⏱ ${durTxt(d.min)}</span>` : '',
    d.calc === true ? '<span>🧮 calculatrice</span>' : d.calc === false ? '<span>🚫 sans calculatrice</span>' : '',
    d.st ? `<span>★ ${d.st} exo${d.st > 1 ? 's' : ''} étoilé${d.st > 1 ? 's' : ''}</span>` : ''
  ].filter(Boolean).join('');
  const ttl = d.t + (d.i ? ' · ' + d.i : '');
  const feel = FEEL.map(([l, v]) => `<button class="chip" data-act="feel" data-id="${d.id}" data-v="${v}" aria-pressed="${x && x.dl === v}">${l}</button>`).join('');
  return `<article class="card glass ${x ? 'done' : ''}" data-id="${d.id}">
  <div class="top">${ring}<div class="grow"><h3 class="ctitle" style="all:unset;display:block;font-weight:680;font-size:1.04rem;line-height:1.25">${esc(d.t)}</h3><p class="cinfo">${esc(d.i || '')}${d.src ? ` · ${esc(d.src)}` : ''}</p></div>
  ${x ? `<span class="badge">Fait${x.n != null && x.n !== '' ? ' · ' + esc(x.n) + '/20' : ''}</span>` : ''}</div>
  <div class="meta">${meta}</div>
  <div class="tags">${tags}</div>
  <div class="acts">
    <button class="btn pri sm" data-act="open" data-s="${d.pdf}" data-c="${hasCor ? d.cor : ''}" data-ttl="${esc(ttl)}">Sujet</button>
    ${hasCor ? `<button class="btn sm" data-act="open" data-s="${d.cor}" data-ttl="${esc('Corrigé · ' + ttl)}">Corrigé</button>` : d.cor === 'inclus' ? '<span class="badge">Corrigé inclus</span>' : '<span class="badge mute">Pas de corrigé</span>'}
  </div>
  <details class="more" data-id="${d.id}" ${OPEN.has(d.id) ? 'open' : ''}><summary>Pourquoi ce niveau · mon ressenti</summary>
    <p class="why">${esc(d.why)}</p>
    <p class="sub" style="margin:8px 0 2px">Après l’avoir fait, comment l’as-tu trouvé ? Le niveau se règle sur toi.</p>
    <div class="fb">${feel}</div>
    <div class="fields"><input type="number" inputmode="decimal" min="0" max="20" step="0.25" placeholder="Note /20" value="${x && x.n != null ? esc(x.n) : ''}" data-act="note" data-id="${d.id}" aria-label="Ma note sur 20"><input type="number" inputmode="numeric" min="0" step="1" placeholder="Temps (min)" value="${x && x.m != null ? esc(x.m) : ''}" data-act="time" data-id="${d.id}" aria-label="Mon temps en minutes">${x ? `<button class="btn sm" data-act="undo" data-id="${d.id}">Effacer</button>` : ''}</div>
  </details></article>`;
}

/* ---------- vues ---------- */
const V = $('#view');
function viewConseiller() {
  const chips = m => DATA.tags.filter(t => t.m === m).map(t => `<button class="chip ${m}" data-act="tag" data-t="${t.id}" aria-pressed="${S.sel.includes(t.id)}">${esc(t.t)}</button>`).join('');
  const nrev = DATA.cours.filter(c => chState(c.id).rev).length;
  V.innerHTML = `<h1>Quel DS faire ?</h1>
  <p class="lead">Coche les notions de ton contrôle, choisis le niveau voulu : je classe les meilleurs DS pour toi.</p>
  <section class="glass panel">
    <p class="label">Notions du contrôle <small id="nsel"></small></p>
    <h3 style="margin-top:4px">Spécialité</h3><div class="chips">${chips('spe')}</div>
    <h3>Maths expertes</h3><div class="chips">${chips('exp')}</div>
    <div class="acts">${nrev ? `<button class="btn sm" data-act="fromrev">Reprendre mes ${nrev} chapitre${nrev > 1 ? 's' : ''} à réviser</button>` : ''}<button class="btn sm" data-act="clear">Tout décocher</button></div>
  </section>
  <section class="glass panel">
    <p class="label">Niveau voulu <small id="lvl"></small></p>
    <input type="range" id="lv" min="1" max="5" step="1" value="${S.lv}" aria-label="Niveau voulu">
    <div class="ticks"><span>Échauffement</span><span>Scolaire</span><span>Contrôle</span><span>Exigeant</span><span>Défi</span></div>
    <div class="row" style="margin-top:14px">
      <select id="max" aria-label="Durée maximale"><option value="0">Toute durée</option><option value="45">45 min max</option><option value="60">1 h max</option><option value="120">2 h max</option><option value="240">4 h max</option></select>
      <select id="calc" aria-label="Calculatrice"><option value="any">Avec ou sans 🧮</option><option value="no">Sans calculatrice</option><option value="yes">Avec calculatrice</option></select>
    </div>
    <div class="opts">
      <label class="switch"><input type="checkbox" id="cor" ${S.cor ? 'checked' : ''}>Avec corrigé</label>
      <label class="switch"><input type="checkbox" id="hideDone" ${S.hideDone ? 'checked' : ''}>Cacher les faits</label>
      <label class="switch" style="grid-column:1/-1"><input type="checkbox" id="more" ${S.more ? 'checked' : ''}>Inclure TD, archives, hors-programme</label>
    </div>
  </section>
  <div class="count" id="count"></div><div id="res"></div>`;
  $('#max').value = String(S.max); $('#calc').value = S.calc;
  updConseiller();
}
function updConseiller() {
  $('#nsel').textContent = S.sel.length ? S.sel.length + ' choisie' + (S.sel.length > 1 ? 's' : '') : 'aucune';
  $('#lvl').textContent = LV[S.lv] + ' · ' + LVD[S.lv];
  $$('[data-act=tag]').forEach(b => b.setAttribute('aria-pressed', String(S.sel.includes(b.dataset.t))));
  let list = pool().map(d => ({ d, sc: score(d) }));
  if (S.sel.length) list = list.filter(x => x.sc.cov > 0);
  list.sort((a, b) => b.sc.s - a.sc.s || (b.d.date || '').localeCompare(a.d.date || ''));
  $('#count').textContent = !S.sel.length ? 'Choisis au moins une notion pour un classement précis. En attendant : tous les DS triés par niveau.' : list.length ? `${list.length} DS correspondent · classés du plus adapté au moins adapté` : 'Aucun DS ne correspond : élargis la durée, la calculatrice ou le niveau.';
  $('#res').innerHTML = list.map(x => card(x.d, x.sc)).join('');
}
function viewBiblio() {
  const L = S.lib;
  const seg = (key, opts) => `<div class="chips" style="margin-bottom:8px">${opts.map(([v, l]) => `<button class="chip" data-act="lib" data-key="${key}" data-v="${v}" aria-pressed="${L[key] === v}">${l}</button>`).join('')}</div>`;
  V.innerHTML = `<h1>Tous les DS</h1><p class="lead">${DATA.docs.length} documents. Cherche par chapitre, titre ou source.</p>
  <section class="glass panel"><input type="search" id="q" placeholder="suites, convexité, complexes, Hattab…" value="${esc(L.q)}" aria-label="Rechercher" style="margin-bottom:12px">
  ${seg('tr', [['all', 'Tout'], ['spe', 'Spé'], ['exp', 'Expertes']])}
  ${seg('k', [['all', 'Tout'], ['ds', 'DS'], ['bb', 'Bacs blancs'], ['ic', 'Interros'], ['td', 'TD'], ['arch', 'Archives']])}</section><div id="res"></div>`;
  updBiblio();
}
function updBiblio() {
  const L = S.lib, q = norm(L.q.trim());
  $$('[data-act=lib]').forEach(b => b.setAttribute('aria-pressed', String(S.lib[b.dataset.key] === b.dataset.v)));
  let list = DATA.docs.filter(d => (L.tr === 'all' || d.tr === L.tr) && (L.k === 'all' || (L.k === 'ds' ? ['ds', 'dt', 'dm'].includes(d.k) : d.k === L.k)) &&
    (!q || norm([d.t, d.i, d.src, d.tags.map(tagName).join(' '), KIND[d.k]].join(' ')).includes(q)));
  list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.t.localeCompare(b.t));
  $('#res').innerHTML = list.length ? list.map(d => card(d)).join('') : '<p class="empty">Aucun document ne correspond.</p>';
}
function viewCours() {
  const cnt = [0, 0, 0, 0]; DATA.cours.forEach(c => cnt[chState(c.id).st]++);
  const bar = cnt.map((k, i) => k ? `<span style="width:${k / DATA.cours.length * 100}%;background:var(${SCOL[i]})"></span>` : '').join('');
  const leg = cnt.map((k, i) => `<span><i style="background:var(${SCOL[i]})"></i>${STATUS[i]} : ${k}</span>`).join('');
  const one = c => {
    const s = chState(c.id), nl = DATA.lac.filter(l => l.m === c.m && l.n === c.n).length;
    return `<article class="ch glass"><div class="row"><div class="grow"><p class="ct"><small>${c.m === 'spe' ? 'Spé' : 'Exp'} Ch. ${c.n}</small>${esc(c.t)}</p>${nl ? `<span class="sub">${nl} lacune${nl > 1 ? 's' : ''} en cours</span>` : ''}</div>
    <button class="btn pri sm" data-act="open" data-s="${c.cours}" data-ttl="${esc('Cours · ' + c.t)}">Cours</button>
    ${c.fiche ? `<button class="btn sm" data-act="open" data-s="${c.fiche}" data-ttl="${esc('Fiche · ' + c.t)}">Fiche</button>` : ''}</div>
    <div class="row" style="margin-top:10px"><span class="dot" style="background:var(${SCOL[s.st]})"></span>
    <select data-act="status" data-id="${c.id}" aria-label="Où j'en suis : ${esc(c.t)}">${STATUS.map((x, i) => `<option value="${i}" ${i === s.st ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <label class="switch"><input type="checkbox" data-act="rev" data-id="${c.id}" ${s.rev ? 'checked' : ''}>À réviser</label></div></article>`;
  };
  const nrev = DATA.cours.filter(c => chState(c.id).rev).length;
  V.innerHTML = `<h1>Cours</h1><p class="lead">Les chapitres de M. Hattab, Spé et Expertes. Note où tu en es et coche ceux du prochain contrôle.</p>
  <section class="glass panel"><div class="prog">${bar}</div><div class="legend">${leg}</div>
  ${nrev ? `<div class="acts"><button class="btn pri sm" data-act="fromrev">Trouver des DS pour mes ${nrev} chapitre${nrev > 1 ? 's' : ''} à réviser</button></div>` : '<p class="sub" style="margin:10px 0 0">Coche « À réviser » sur les chapitres d’un contrôle pour trouver les DS adaptés.</p>'}</section>
  <h3>Spécialité</h3>${DATA.cours.filter(c => c.m === 'spe').map(one).join('')}
  <h3>Maths expertes</h3>${DATA.cours.filter(c => c.m === 'exp').map(one).join('')}`;
}
function viewPlus() {
  const slugs = allSlugs(), have = slugs.filter(s => HAVE.has(s)).length;
  const lac = m => {
    const L = DATA.lac.filter(l => l.m === m); if (!L.length) return '<p class="empty">Aucune lacune pour l’instant.</p>';
    const g = {}; L.forEach(l => { const k = l.n + '|' + l.sub; (g[k] = g[k] || []).push(l); });
    return Object.entries(g).map(([k, a]) => { const [n, sub] = k.split('|'); return `<details class="lacg glass"><summary>Ch. ${n} · ${esc(sub)}<small>${a.length} lacune${a.length > 1 ? 's' : ''}</small></summary><ul>${a.map(l => `<li><span class="lt">${esc(l.type)}</span><b>${esc(l.titre)}</b>${l.meta ? `<span class="ld">${esc(l.meta)}</span>` : ''}${l.lines.map(x => `<p>${esc(x)}</p>`).join('')}</li>`).join('')}</ul></details>`; }).join('');
  };
  const nich = DATA.niches.map(n => `<article class="ch glass"><div class="row"><div class="grow"><p class="ct">★ ${esc(n.t)} <small style="margin:0">· ${esc(n.ch)}</small></p></div><button class="btn sm" data-act="open" data-s="${n.pdf}" data-ttl="${esc(n.t)}">PDF</button></div></article>`).join('');
  V.innerHTML = `<h1>Plus</h1>
  <h2 id="hl">Hors-ligne</h2>
  <section class="glass panel"><p class="label">Mes PDF dans le téléphone <small>${have} / ${slugs.length}</small></p>
  <div class="bar"><i style="width:${Math.round(have / slugs.length * 100)}%"></i></div>
  ${have < slugs.length ? `<p class="sub">Une seule fois : ouvre le dossier <b>recueil-pdf.zip</b> dans Fichiers pour le décompresser, puis choisis ici tous les PDF du dossier. Ils restent ensuite dans l’appli, sans Wi-Fi.</p>` : '<p class="sub">Tous les PDF sont dans l’appli. Tu peux travailler sans Wi-Fi.</p>'}
  <div class="acts"><label class="btn pri sm" style="cursor:pointer">Importer des PDF<input type="file" id="imp" accept="application/pdf,.pdf" multiple hidden></label>${have ? '<button class="btn sm" data-act="wipe">Supprimer les PDF importés</button>' : ''}</div>
  <p class="sub" id="impmsg" style="margin-top:10px"></p>
  <details class="more"><summary>Installer sur l’écran d’accueil (recommandé)</summary><p class="sub" style="margin-top:8px">Dans Safari : Partager, puis « Sur l’écran d’accueil ». Fais-le avant d’importer les PDF : l’appli installée garde ses fichiers sans limite de durée.</p></details></section>
  <h2>★ Trucs niches</h2>${nich}
  <h2>Lacunes</h2><h3>Spécialité</h3>${lac('spe')}<h3>Maths expertes</h3>${lac('exp')}
  <h2>Réglages</h2><section class="glass panel"><button class="btn sm" data-act="reset">Effacer mes statuts, notes et ressentis</button></section>`;
  loadMath();
}
let mathLoading = false;
function loadMath() {
  const go = () => window.MathJax && MathJax.typesetPromise && MathJax.typesetPromise([V]).catch(() => { });
  if (window.MathJax && MathJax.typesetPromise) return go();
  if (mathLoading) return; mathLoading = true;
  window.MathJax = { tex: { inlineMath: [['$', '$']] }, svg: { fontCache: 'global' } };
  const s = document.createElement('script'); s.src = 'vendor/tex-svg.js'; s.onload = () => setTimeout(go, 50); s.onerror = () => { mathLoading = false; };
  document.head.appendChild(s);
}

/* ---------- navigation ---------- */
const VIEWS = { conseiller: viewConseiller, biblio: viewBiblio, cours: viewCours, plus: viewPlus };
let cur = 'conseiller';
function go(v, keepScroll) {
  cur = VIEWS[v] ? v : 'conseiller';
  $$('#tabbar button').forEach(b => { if (b.dataset.v === cur) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  VIEWS[cur](); if (!keepScroll) window.scrollTo(0, 0);
  if (location.hash !== '#' + cur) history.replaceState(null, '', '#' + cur);
}
const refresh = () => { const y = scrollY; VIEWS[cur](); scrollTo(0, y); };
const rerenderRes = () => { if (cur === 'conseiller') updConseiller(); else if (cur === 'biblio') updBiblio(); };

/* ---------- événements ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act],#tabbar button'); if (!t) return;
  if (t.closest('#tabbar')) return go(t.dataset.v);
  const a = t.dataset.act;
  if (a === 'tag') { const i = S.sel.indexOf(t.dataset.t); i < 0 ? S.sel.push(t.dataset.t) : S.sel.splice(i, 1); save(); updConseiller(); }
  else if (a === 'clear') { S.sel = []; save(); updConseiller(); }
  else if (a === 'fromrev') { S.sel = [...new Set(DATA.cours.filter(c => chState(c.id).rev).flatMap(c => c.tags))]; save(); go('conseiller'); }
  else if (a === 'open') openDoc(t.dataset.s, t.dataset.ttl, t.dataset.c);
  else if (a === 'feel') { const x = S.done[t.dataset.id] = S.done[t.dataset.id] || {}; const v = +t.dataset.v; x.dl = x.dl === v ? null : v; if (x.dl == null && x.n == null && x.m == null) delete S.done[t.dataset.id]; x.dt = x.dt || new Date().toISOString().slice(0, 10); save(); OPEN.add(t.dataset.id); rerenderRes(); }
  else if (a === 'undo') { delete S.done[t.dataset.id]; save(); OPEN.add(t.dataset.id); rerenderRes(); }
  else if (a === 'lib') { S.lib[t.dataset.key] = t.dataset.v; save(); updBiblio(); }
  else if (a === 'wipe') { if (confirm('Supprimer les PDF importés de l’appli ?')) idbClear().then(() => { HAVE.clear(); refresh(); }); }
  else if (a === 'reset') { if (confirm('Effacer tous tes statuts, notes et ressentis ?')) { S = JSON.parse(JSON.stringify(DEF)); save(); refresh(); } }
});
document.addEventListener('change', e => {
  const t = e.target, a = t.dataset && t.dataset.act;
  if (t.id === 'max') { S.max = +t.value; save(); updConseiller(); }
  else if (t.id === 'calc') { S.calc = t.value; save(); updConseiller(); }
  else if (['cor', 'hideDone', 'more'].includes(t.id)) { S[t.id] = t.checked; save(); updConseiller(); }
  else if (a === 'status') { chState(t.dataset.id).st = +t.value; save(); refresh(); }
  else if (a === 'rev') { chState(t.dataset.id).rev = t.checked; save(); refresh(); }
  else if (a === 'note' || a === 'time') {
    const x = S.done[t.dataset.id] = S.done[t.dataset.id] || {}; x.dt = x.dt || new Date().toISOString().slice(0, 10);
    const v = t.value === '' ? null : t.value; if (a === 'note') x.n = v; else x.m = v;
    if (x.dl == null && x.n == null && x.m == null) delete S.done[t.dataset.id];
    save(); OPEN.add(t.dataset.id); rerenderRes();
  } else if (t.id === 'imp') importFiles([...t.files]);
});
document.addEventListener('input', e => {
  if (e.target.id === 'lv') { S.lv = +e.target.value; save(); updConseiller(); }
  else if (e.target.id === 'q') { S.lib.q = e.target.value; save(); updBiblio(); }
});
document.addEventListener('toggle', e => { const d = e.target; if (d.matches && d.matches('details.more[data-id]')) { d.open ? OPEN.add(d.dataset.id) : OPEN.delete(d.dataset.id); } }, true);

/* ---------- import des PDF ---------- */
async function importFiles(files) {
  const known = new Set(allSlugs()), msg = $('#impmsg'); let ok = 0, skip = [];
  const slugOf = n => norm(n.replace(/\.pdf$/i, '')).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  for (let i = 0; i < files.length; i++) {
    const f = files[i], s = slugOf(f.name);
    if (!known.has(s)) { skip.push(f.name); continue; }
    try { await idbPut(s, await f.arrayBuffer()); HAVE.add(s); ok++; } catch (err) { skip.push(f.name); }
    if (msg) msg.textContent = `Import… ${i + 1} / ${files.length}`;
  }
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }
  refresh();
  const m2 = $('#impmsg'); if (m2) m2.textContent = `${ok} PDF importé${ok > 1 ? 's' : ''}.` + (skip.length ? ` ${skip.length} fichier${skip.length > 1 ? 's' : ''} non reconnu${skip.length > 1 ? 's' : ''} (noms attendus : ceux du dossier recueil-pdf).` : '');
}

/* ---------- lecteur PDF ---------- */
let PDF = null, ZOOM = 1, TOK = 0, VCUR = null, IO = null;
if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
async function pdfBytes(slug) {
  const b = await idbGet(slug);
  if (b) return new Uint8Array(b.slice(0));
  const r = await fetch('pdf/' + slug + '.pdf'); if (!r.ok) throw new Error('absent');
  const buf = await r.arrayBuffer(); if (!buf.byteLength) throw new Error('absent');
  return new Uint8Array(buf);
}
async function openDoc(slug, ttl, corSlug) {
  const vw = $('#viewer'); VCUR = { s: slug, c: corSlug || '', ttl };
  $('#vttl').textContent = ttl; vw.classList.add('on'); document.body.style.overflow = 'hidden';
  const sw = $('#vsw'); sw.hidden = !corSlug; $$('#vsw button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.w === 'sujet')));
  VCUR.cur = slug; ZOOM = 1; await loadPdf(slug);
}
async function loadPdf(slug) {
  const body = $('#vbody'), my = ++TOK; body.innerHTML = '<p class="vmsg">Chargement…</p>'; PDF = null;
  try {
    if (!window.pdfjsLib) throw new Error('lecteur');
    const data = await pdfBytes(slug);
    PDF = await pdfjsLib.getDocument({ data, disableRange: true, disableStream: true }).promise;
    if (my !== TOK) return; await buildPages(my);
  } catch (e) {
    if (my !== TOK) return;
    body.innerHTML = `<div class="vmsg">Ce PDF n’est pas encore dans l’appli.<br><br><button class="btn pri sm" id="togo">Aller l’importer</button></div>`;
    $('#togo').onclick = () => { closeDoc(); go('plus'); };
  }
}
async function buildPages(my) {
  const body = $('#vbody'); body.innerHTML = '';
  if (IO) IO.disconnect();
  const w = Math.min(body.clientWidth - 20, 980) * ZOOM;
  const p1 = await PDF.getPage(1), v1 = p1.getViewport({ scale: 1 }), h = v1.height * w / v1.width;
  IO = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting && !en.target.dataset.done) { en.target.dataset.done = '1'; renderPage(en.target, w, my); } }), { root: body, rootMargin: '900px 0px' });
  for (let i = 1; i <= PDF.numPages; i++) {
    const d = document.createElement('div'); d.className = 'pg'; d.dataset.i = i; d.style.width = w + 'px'; d.style.height = h + 'px';
    body.appendChild(d); IO.observe(d);
  }
}
async function renderPage(div, w, my) {
  try {
    const page = await PDF.getPage(+div.dataset.i); if (my !== TOK) return;
    const base = page.getViewport({ scale: 1 }), sc = w / base.width, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vp = page.getViewport({ scale: sc * dpr }), c = document.createElement('canvas');
    c.width = vp.width; c.height = vp.height; c.style.width = w + 'px'; c.style.height = (base.height * sc) + 'px';
    div.style.height = (base.height * sc) + 'px'; div.appendChild(c);
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  } catch (e) { /* page annulée */ }
}
function closeDoc() { TOK++; if (IO) IO.disconnect(); $('#viewer').classList.remove('on'); document.body.style.overflow = ''; $('#vbody').innerHTML = ''; PDF = null; }
$('#vclose').onclick = closeDoc;
$('#vplus').onclick = () => { if (PDF) { ZOOM = Math.min(ZOOM * 1.25, 3); buildPages(++TOK); } };
$('#vminus').onclick = () => { if (PDF) { ZOOM = Math.max(ZOOM / 1.25, .6); buildPages(++TOK); } };
$('#vsw').onclick = e => {
  const b = e.target.closest('button'); if (!b || !VCUR) return;
  $$('#vsw button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  const s = b.dataset.w === 'cor' ? VCUR.c : VCUR.s; $('#vttl').textContent = (b.dataset.w === 'cor' ? 'Corrigé · ' : '') + VCUR.ttl; ZOOM = 1; loadPdf(s);
};
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#viewer').classList.contains('on')) closeDoc(); });

/* ---------- démarrage ---------- */
(async function init() {
  try { DATA = await (await fetch('data/docs.json')).json(); }
  catch (e) { V.innerHTML = '<p class="empty">Impossible de charger les données. Ouvre l’appli une première fois avec du réseau.</p>'; return; }
  HAVE = new Set(await idbKeys());
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (VIEWS[h] && h !== cur) go(h); });
  go(VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'conseiller');
})();
})();
