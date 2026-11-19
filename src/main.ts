import './style.css';
import { registerSW } from 'virtual:pwa-register';
import type { Category, Progress, SessionCard, SessionMode } from './types';
import { deleteCustomCategory, importCategoriesFromJson, loadBuiltInCategories } from './data';
import { loadCustomCategories, loadProgress, progressKey, recordAnswer, resetProgress, saveProgress } from './storage';

// ---------- Stan ----------
type Screen =
  | { name: 'home' }
  | { name: 'setup'; categoryId: string }
  | { name: 'quiz' }
  | { name: 'summary' }
  | { name: 'settings' };

const app = document.getElementById('app')!;
let screen: Screen = { name: 'home' };
let categories: Category[] = [];
let dataVersion = '';
let progress: Progress = loadProgress();
let session: SessionCard[] = [];
let sessionIndex = 0;
let sessionCategoryId = '';
let flash = '';

const LETTERS = ['A', 'B', 'C', 'D'];
const MODE_LABELS: Record<SessionMode, string> = {
  mix: 'Losowo',
  weak: 'Najsłabsze najpierw',
  wrong: 'Tylko błędne',
  new: 'Tylko nowe'
};

// ---------- Pomocnicze ----------
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stats(cat: Category) {
  let seen = 0;
  let mastered = 0;
  let wrong = 0;
  for (const q of cat.questions) {
    const p = progress[progressKey(cat.id, q.id)];
    if (!p) continue;
    seen++;
    if (p.box >= 4) mastered++;
    if (p.lastWrong) wrong++;
  }
  return { total: cat.questions.length, seen, mastered, wrong };
}

function topicsOf(cat: Category): string[] {
  return [...new Set(cat.questions.map((q) => q.topic).filter((t): t is string => !!t))];
}

function go(s: Screen) {
  screen = s;
  render();
  window.scrollTo(0, 0);
}

// ---------- Dane ----------
async function loadData() {
  let builtIn: Category[] = [];
  try {
    const res = await loadBuiltInCategories();
    builtIn = res.categories;
    dataVersion = res.version;
  } catch (e) {
    console.error(e);
    flash = 'Nie udało się wczytać wbudowanych pytań.';
  }
  // Własne pytania o id istniejącej kategorii dopisują się do niej
  const custom = loadCustomCategories();
  for (const c of custom) {
    const existing = builtIn.find((b) => b.id === c.id);
    if (existing) {
      const ids = new Set(c.questions.map((q) => q.id));
      existing.questions = [...existing.questions.filter((q) => !ids.has(q.id)), ...c.questions];
    } else {
      builtIn.push(c);
    }
  }
  categories = builtIn;
}

function buildSession(cat: Category, mode: SessionMode, count: number, topic: string): SessionCard[] {
  let pool = cat.questions.filter((q) => !topic || q.topic === topic);
  const p = (id: string) => progress[progressKey(cat.id, id)];

  if (mode === 'wrong') pool = pool.filter((q) => p(q.id)?.lastWrong);
  if (mode === 'new') pool = pool.filter((q) => !p(q.id));

  if (mode === 'weak') {
    pool = shuffle(pool).sort((a, b) => {
      const pa = p(a.id);
      const pb = p(b.id);
      return (pa?.box ?? 0) - (pb?.box ?? 0) || (pa?.last ?? 0) - (pb?.last ?? 0);
    });
  } else {
    pool = shuffle(pool);
  }

  const picked = count > 0 ? pool.slice(0, count) : pool;
  return picked.map((q) => {
    // Tasujemy odpowiedzi i przeliczamy, gdzie jest poprawna
    const order = shuffle([0, 1, 2, 3]);
    return {
      q,
      categoryId: cat.id,
      answers: order.map((i) => q.answers[i]),
      correct: order.indexOf(q.correct)
    };
  });
}

// ---------- Widoki ----------
function viewHome(): string {
  const items = categories
    .map((c) => {
      const s = stats(c);
      const pct = s.total ? Math.round((s.mastered / s.total) * 100) : 0;
      return `
      <button class="card category" data-action="open-category" data-id="${esc(c.id)}">
        <div class="row">
          <strong>${esc(c.name)}</strong>
          ${c.custom ? '<span class="badge">własne</span>' : ''}
        </div>
        ${c.description ? `<p class="muted">${esc(c.description)}</p>` : ''}
        <div class="bar"><span style="width:${pct}%"></span></div>
        <p class="muted small">${s.total} pytań · opanowane ${s.mastered} · do poprawy ${s.wrong}</p>
      </button>`;
    })
    .join('');

  return `
    <header class="top">
      <h1>Fiszki</h1>
      <button class="icon-btn" data-action="settings" aria-label="Ustawienia">⚙️</button>
    </header>
    ${flash ? `<p class="flash">${esc(flash)}</p>` : ''}
    <p class="muted">Wybierz kategorię</p>
    <div class="list">${items || '<p class="muted">Brak kategorii.</p>'}</div>
    <p class="muted small center">Baza pytań: ${esc(dataVersion || '—')}</p>
  `;
}

function viewSetup(cat: Category): string {
  const s = stats(cat);
  const topics = topicsOf(cat);
  const modes = (Object.keys(MODE_LABELS) as SessionMode[])
    .map(
      (m, i) => `
      <label class="option">
        <input type="radio" name="mode" value="${m}" ${i === 0 ? 'checked' : ''}/>
        <span>${MODE_LABELS[m]}${m === 'wrong' ? ` (${s.wrong})` : ''}${m === 'new' ? ` (${s.total - s.seen})` : ''}</span>
      </label>`
    )
    .join('');
  const counts = [10, 20, 0]
    .map(
      (n, i) => `
      <label class="option inline">
        <input type="radio" name="count" value="${n}" ${i === 0 ? 'checked' : ''}/>
        <span>${n === 0 ? 'Wszystkie' : n}</span>
      </label>`
    )
    .join('');
  const topicSelect = topics.length
    ? `<h3>Temat</h3>
       <select name="topic" class="select">
         <option value="">Wszystkie tematy</option>
         ${topics.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}
       </select>`
    : '';

  return `
    <header class="top">
      <button class="icon-btn" data-action="home" aria-label="Wstecz">←</button>
      <h1>${esc(cat.name)}</h1>
      <span></span>
    </header>
    <form id="setup-form" class="card">
      <h3>Tryb</h3>
      ${modes}
      <h3>Liczba pytań</h3>
      <div class="inline-group">${counts}</div>
      ${topicSelect}
      <button type="submit" class="primary">Start</button>
    </form>
    ${
      s.seen
        ? `<button class="link danger" data-action="reset-category" data-id="${esc(cat.id)}">Wyzeruj postęp w tej kategorii</button>`
        : ''
    }
    ${
      cat.custom
        ? `<button class="link danger" data-action="delete-category" data-id="${esc(cat.id)}">Usuń tę zaimportowaną kategorię</button>`
        : ''
    }
  `;
}

function viewQuiz(): string {
  const card = session[sessionIndex];
  const answered = card.chosen !== undefined;
  const buttons = card.answers
    .map((a, i) => {
      let cls = 'answer';
      if (answered) {
        if (i === card.correct) cls += ' correct';
        else if (i === card.chosen) cls += ' wrong';
        else cls += ' dim';
      }
      return `<button class="${cls}" data-action="answer" data-i="${i}" ${answered ? 'disabled' : ''}>
        <span class="letter">${LETTERS[i]}</span><span>${esc(a)}</span>
      </button>`;
    })
    .join('');

  const ok = card.chosen === card.correct;
  const feedback = answered
    ? `<div class="feedback ${ok ? 'ok' : 'bad'}">
         <strong>${ok ? '✔ Dobrze!' : `✘ Poprawna odpowiedź: ${LETTERS[card.correct]}`}</strong>
         ${card.q.explanation ? `<p>${esc(card.q.explanation)}</p>` : ''}
       </div>
       <button class="primary" data-action="next">${sessionIndex + 1 < session.length ? 'Dalej' : 'Podsumowanie'}</button>`
    : '';

  return `
    <header class="top">
      <button class="icon-btn" data-action="quit" aria-label="Zakończ">✕</button>
      <span class="muted">${sessionIndex + 1} / ${session.length}</span>
      <span></span>
    </header>
    <div class="bar thin"><span style="width:${(sessionIndex / session.length) * 100}%"></span></div>
    <div class="card question">
      ${card.q.topic || card.q.source ? `<p class="muted small">${esc([card.q.topic, card.q.source].filter(Boolean).join(' · '))}</p>` : ''}
      <h2>${esc(card.q.question)}</h2>
    </div>
    <div class="answers">${buttons}</div>
    ${feedback}
  `;
}

function viewSummary(): string {
  const good = session.filter((c) => c.chosen === c.correct).length;
  const wrong = session.filter((c) => c.chosen !== undefined && c.chosen !== c.correct);
  const pct = session.length ? Math.round((good / session.length) * 100) : 0;
  const list = wrong
    .map(
      (c) => `
      <li>
        <p>${esc(c.q.question)}</p>
        <p class="small"><span class="bad-text">Twoja: ${esc(c.answers[c.chosen!])}</span><br/>
        <span class="ok-text">Poprawna: ${esc(c.answers[c.correct])}</span></p>
      </li>`
    )
    .join('');

  return `
    <header class="top"><span></span><h1>Wynik</h1><span></span></header>
    <div class="card center">
      <p class="score">${pct}%</p>
      <p class="muted">${good} z ${session.length} poprawnie</p>
    </div>
    ${wrong.length ? `<button class="primary" data-action="retry-wrong">Powtórz błędne (${wrong.length})</button>` : ''}
    <button class="secondary" data-action="open-category" data-id="${esc(sessionCategoryId)}">Nowa sesja</button>
    <button class="secondary" data-action="home">Kategorie</button>
    ${wrong.length ? `<h3>Pomyłki</h3><ul class="mistakes">${list}</ul>` : ''}
  `;
}

function viewSettings(): string {
  return `
    <header class="top">
      <button class="icon-btn" data-action="home" aria-label="Wstecz">←</button>
      <h1>Ustawienia</h1>
      <span></span>
    </header>
    ${flash ? `<p class="flash">${esc(flash)}</p>` : ''}
    <div class="card">
      <h3>Importuj pytania z pliku</h3>
      <p class="muted small">Plik .json z kategorią i pytaniami (format w README). Pytania zostają tylko na tym telefonie.</p>
      <label class="secondary file-btn">Wybierz plik
        <input type="file" accept=".json,application/json" id="import-questions" hidden />
      </label>
    </div>
    <div class="card">
      <h3>Kopia zapasowa postępów</h3>
      <button class="secondary" data-action="export-progress">Eksportuj postępy</button>
      <label class="secondary file-btn">Importuj postępy
        <input type="file" accept=".json,application/json" id="import-progress" hidden />
      </label>
    </div>
    <div class="card">
      <h3>Reset</h3>
      <button class="secondary danger" data-action="reset-all">Wyzeruj wszystkie postępy</button>
    </div>
    <p class="muted small center">Baza pytań: ${esc(dataVersion || '—')} · Działa offline, nic nie jest wysyłane.</p>
  `;
}

function render() {
  const s = screen;
  let html = '';
  if (s.name === 'home') html = viewHome();
  else if (s.name === 'setup') {
    const cat = categories.find((c) => c.id === s.categoryId);
    html = cat ? viewSetup(cat) : viewHome();
  } else if (s.name === 'quiz') html = viewQuiz();
  else if (s.name === 'summary') html = viewSummary();
  else html = viewSettings();
  app.innerHTML = html;
  flash = '';
}

// ---------- Zdarzenia ----------
app.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id ?? '';

  switch (action) {
    case 'home':
      go({ name: 'home' });
      break;
    case 'settings':
      go({ name: 'settings' });
      break;
    case 'open-category':
      go({ name: 'setup', categoryId: id });
      break;
    case 'answer': {
      const card = session[sessionIndex];
      if (card.chosen !== undefined) return;
      card.chosen = Number(el.dataset.i);
      recordAnswer(progress, progressKey(card.categoryId, card.q.id), card.chosen === card.correct);
      render();
      break;
    }
    case 'next':
      if (sessionIndex + 1 < session.length) {
        sessionIndex++;
        go({ name: 'quiz' });
      } else go({ name: 'summary' });
      break;
    case 'quit':
      if (session.some((c) => c.chosen !== undefined)) go({ name: 'summary' });
      else go({ name: 'home' });
      break;
    case 'retry-wrong': {
      const wrong = session.filter((c) => c.chosen !== c.correct);
      session = shuffle(wrong).map((c) => {
        const order = shuffle([0, 1, 2, 3]);
        return { ...c, chosen: undefined, answers: order.map((i) => c.q.answers[i]), correct: order.indexOf(c.q.correct) };
      });
      sessionIndex = 0;
      go({ name: 'quiz' });
      break;
    }
    case 'reset-category':
      if (confirm('Wyzerować postęp w tej kategorii?')) {
        resetProgress(id);
        progress = loadProgress();
        render();
      }
      break;
    case 'delete-category':
      if (confirm('Usunąć zaimportowane pytania tej kategorii?')) {
        deleteCustomCategory(id);
        resetProgress(id);
        progress = loadProgress();
        loadData().then(() => go({ name: 'home' }));
      }
      break;
    case 'reset-all':
      if (confirm('Na pewno wyzerować WSZYSTKIE postępy?')) {
        resetProgress();
        progress = loadProgress();
        flash = 'Postępy wyzerowane.';
        render();
      }
      break;
    case 'export-progress': {
      const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `fiszki-postepy-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      break;
    }
  }
});

app.addEventListener('submit', (e) => {
  const form = e.target as HTMLFormElement;
  if (form.id !== 'setup-form' || screen.name !== 'setup') return;
  e.preventDefault();
  const data = new FormData(form);
  const cat = categories.find((c) => c.id === (screen as { categoryId: string }).categoryId)!;
  const mode = data.get('mode') as SessionMode;
  const count = Number(data.get('count'));
  const topic = (data.get('topic') as string) || '';
  const cards = buildSession(cat, mode, count, topic);
  if (!cards.length) {
    alert('Brak pytań dla wybranych ustawień.');
    return;
  }
  session = cards;
  sessionIndex = 0;
  sessionCategoryId = cat.id;
  go({ name: 'quiz' });
});

app.addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    if (input.id === 'import-questions') {
      const { added, errors } = importCategoriesFromJson(text);
      await loadData();
      flash = `Zaimportowano ${added} pytań.` + (errors.length ? ` Pominięto: ${errors.slice(0, 3).join('; ')}` : '');
    } else if (input.id === 'import-progress') {
      const p = JSON.parse(text);
      if (typeof p !== 'object' || Array.isArray(p)) throw new Error();
      saveProgress(p);
      progress = loadProgress();
      flash = 'Postępy wczytane.';
    }
  } catch {
    flash = 'Nieprawidłowy plik JSON.';
  }
  render();
});

// ---------- Aktualizacje (nowa wersja aplikacji / pytań z GitHub Pages) ----------
const banner = document.getElementById('update-banner')!;
const updateSW = registerSW({
  onNeedRefresh() {
    banner.hidden = false;
  }
});
document.getElementById('update-btn')!.addEventListener('click', () => updateSW(true));

// ---------- Start ----------
app.innerHTML = '<p class="muted center">Wczytywanie…</p>';
loadData().then(render);
