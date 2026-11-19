import type { Category, Progress, QuestionProgress } from './types';

const PROGRESS_KEY = 'fiszki.progress.v1';
const CUSTOM_KEY = 'fiszki.custom.v1';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Nie udało się zapisać danych', e);
  }
}

/** Klucz postępu = kategoria + id pytania, żeby id mogły się powtarzać między kategoriami */
export const progressKey = (categoryId: string, questionId: string) => `${categoryId}:${questionId}`;

export function loadProgress(): Progress {
  return read<Progress>(PROGRESS_KEY, {});
}

export function saveProgress(p: Progress): void {
  write(PROGRESS_KEY, p);
}

export function recordAnswer(p: Progress, key: string, ok: boolean): void {
  const cur: QuestionProgress = p[key] ?? { seen: 0, correct: 0, box: 1, lastWrong: false, last: 0 };
  cur.seen += 1;
  if (ok) cur.correct += 1;
  cur.box = ok ? Math.min(5, cur.box + 1) : 1;
  cur.lastWrong = !ok;
  cur.last = Date.now();
  p[key] = cur;
  saveProgress(p);
}

export function loadCustomCategories(): Category[] {
  return read<Category[]>(CUSTOM_KEY, []).map((c) => ({ ...c, custom: true }));
}

export function saveCustomCategories(list: Category[]): void {
  write(CUSTOM_KEY, list);
}

export function resetProgress(categoryId?: string): void {
  if (!categoryId) {
    saveProgress({});
    return;
  }
  const p = loadProgress();
  for (const k of Object.keys(p)) if (k.startsWith(categoryId + ':')) delete p[k];
  saveProgress(p);
}
