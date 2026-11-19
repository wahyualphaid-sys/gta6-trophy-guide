// Leonida Legend - GTA VI trophy guide & tracker.
// Offline: the only file loaded besides this page is data/trophies.json, served
// from the same folder. Progress lives in localStorage and can be exported to
// and imported from a JSON file. No network requests are made at run time.
const KEY = 'leonida-legend-progress-v1';
const SETTINGS_KEY = 'leonida-legend-settings-v1';

const cardsEl = document.getElementById('cards');
const progressEl = document.getElementById('progress');
const kindEl = document.getElementById('kind');
const gradeEl = document.getElementById('grade');
const searchEl = document.getElementById('search');
const spoilersEl = document.getElementById('spoilers');
const onlyLeftEl = document.getElementById('only-left');

let earned = new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
const savedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
if (typeof savedSettings.hideSpoilers === 'boolean') spoilersEl.checked = savedSettings.hideSpoilers;

const doc = await (await fetch('data/trophies.json')).json();
const trophies = doc.trophies;

// Deep links (also used for the entry's screenshots): ?kind=missable,
// ?grade=silver, ?spoilers=off, ?left=1, ?q=tank preset the controls.
const params = new URLSearchParams(location.search);
if (params.get('kind')) kindEl.value = params.get('kind');
if (params.get('grade')) gradeEl.value = params.get('grade');
if (params.get('q')) searchEl.value = params.get('q');
if (params.get('spoilers') === 'off') spoilersEl.checked = false;
if (params.get('left') === '1') onlyLeftEl.checked = true;

function saveProgress() {
  localStorage.setItem(KEY, JSON.stringify([...earned]));
}
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ hideSpoilers: spoilersEl.checked }));
}

const GRADE_ORDER = { platinum: 0, gold: 1, silver: 2, bronze: 3 };

function matchesKind(t) {
  const want = kindEl.value;
  if (want === 'all') return true;
  if (want === 'online') return (t.tags ?? []).includes('online');
  if (want === 'missable') return t.missable === true;
  return t.kind === want || (t.tags ?? []).includes(want);
}
function matchesGrade(t) {
  return gradeEl.value === 'all' || t.grade === gradeEl.value;
}
function matchesSearch(t) {
  const q = searchEl.value.trim().toLowerCase();
  if (!q) return true;
  const hay = `${t.name} ${t.description} ${t.guide} ${t.kind} ${(t.tags ?? []).join(' ')}`.toLowerCase();
  return hay.includes(q);
}
function isSpoilerHidden(t) {
  // Spoiler setting: story trophies (and other hidden trophies) stay masked
  // until the reader turns spoilers on or ticks the trophy as earned.
  return spoilersEl.checked && t.spoiler === true && !earned.has(t.name);
}

function trophyCard(t) {
  const card = document.createElement('article');
  card.className = `card grade-${t.grade}`;
  if (earned.has(t.name)) card.classList.add('earned');
  if (t.missable) card.classList.add('missable');

  const head = document.createElement('div');
  head.className = 'card-head';

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = earned.has(t.name);
  box.setAttribute('aria-label', `Mark ${t.name} as earned`);
  box.addEventListener('change', () => {
    if (box.checked) earned.add(t.name);
    else earned.delete(t.name);
    saveProgress();
    render();
  });
  head.append(box);

  const title = document.createElement('h3');
  const hidden = isSpoilerHidden(t);
  title.textContent = hidden ? 'Hidden trophy — spoiler protected' : t.name;
  head.append(title);

  const grade = document.createElement('span');
  grade.className = `badge grade-badge-${t.grade}`;
  grade.textContent = t.grade;
  head.append(grade);

  if (t.missable) {
    const flag = document.createElement('span');
    flag.className = 'badge missable-badge';
    flag.textContent = '⚠ potentially missable';
    head.append(flag);
  }
  if (t.hidden) {
    const flag = document.createElement('span');
    flag.className = 'badge hidden-badge';
    flag.textContent = 'hidden trophy';
    head.append(flag);
  }
  card.append(head);

  const desc = document.createElement('p');
  desc.className = 'official';
  desc.textContent = hidden ? 'Description hidden until earned.' : `“${t.description}”`;
  card.append(desc);

  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = `${t.stage} · ${t.kind}${t.tags?.length ? ' · ' + t.tags.join(', ') : ''}`;
  card.append(meta);

  const guide = document.createElement('p');
  guide.className = 'guide';
  guide.textContent = hidden
    ? 'Guide hidden by the spoiler setting. Turn spoilers off above, or tick the trophy once you earn it, to read it.'
    : t.guide;
  card.append(guide);

  const src = document.createElement('p');
  src.className = 'card-source';
  src.textContent = hidden ? '' : `Source: ${t.source}`;
  card.append(src);

  return card;
}

function render() {
  const visible = trophies
    .filter(matchesKind)
    .filter(matchesGrade)
    .filter(matchesSearch)
    .filter((t) => !onlyLeftEl.checked || !earned.has(t.name))
    .sort((a, b) => a.id - b.id);

  cardsEl.replaceChildren(...visible.map(trophyCard));

  const pct = Math.round((earned.size / trophies.length) * 100);
  progressEl.textContent =
    `${earned.size} of ${trophies.length} earned (${pct}%) · showing ${visible.length} · ` +
    `${trophies.filter((t) => t.missable && !earned.has(t.name)).length} missable still open`;
  document.getElementById('stat-earned').textContent = String(earned.size);
  document.getElementById('bar-fill').style.width = `${pct}%`;
}

document.getElementById('export').addEventListener('click', () => {
  const payload = JSON.stringify({ game: doc.game, earned: [...earned] }, null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  a.download = 'leonida-legend-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const names = Array.isArray(parsed) ? parsed : parsed.earned;
    const valid = new Set(trophies.map((t) => t.name));
    earned = new Set((names ?? []).filter((n) => valid.has(n)));
    saveProgress();
    render();
  } catch {
    progressEl.textContent = 'That file could not be read as a progress export.';
  }
});

document.getElementById('reset').addEventListener('click', () => {
  earned = new Set();
  saveProgress();
  render();
});

for (const el of [kindEl, gradeEl, searchEl, onlyLeftEl]) {
  el.addEventListener('input', render);
  el.addEventListener('change', render);
}
spoilersEl.addEventListener('change', () => { saveSettings(); render(); });

render();
