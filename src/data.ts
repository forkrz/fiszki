import type { Category, CategoryMeta, Question } from './types';
import { loadCustomCategories, saveCustomCategories } from './storage';

const BASE = import.meta.env.BASE_URL;

export interface QuestionIndex {
  version: string;
  categories: CategoryMeta[];
}

/** Sprawdza pojedyncze pytanie; zwraca opis błędu albo null */
export function validateQuestion(q: unknown): string | null {
  if (!q || typeof q !== 'object') return 'pytanie nie jest obiektem';
  const o = q as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id) return 'brak pola "id"';
  if (typeof o.question !== 'string' || !o.question) return `${o.id}: brak treści "question"`;
  if (!Array.isArray(o.answers) || o.answers.length !== 4 || !o.answers.every((a) => typeof a === 'string' && a))
    return `${o.id}: "answers" musi mieć dokładnie 4 niepuste odpowiedzi`;
  if (typeof o.correct !== 'number' || !Number.isInteger(o.correct) || o.correct < 0 || o.correct > 3)
    return `${o.id}: "correct" musi być liczbą 0–3 (0 = A … 3 = D)`;
  return null;
}

export async function loadBuiltInCategories(): Promise<{ version: string; categories: Category[] }> {
  const res = await fetch(`${BASE}questions/index.json`);
  if (!res.ok) throw new Error('Nie można wczytać listy kategorii');
  const index = (await res.json()) as QuestionIndex;

  const categories = await Promise.all(
    index.categories.map(async (meta): Promise<Category> => {
      const r = await fetch(`${BASE}questions/${meta.file}`);
      const questions = r.ok ? ((await r.json()) as Question[]) : [];
      return {
        id: meta.id,
        name: meta.name,
        description: meta.description,
        questions: questions.filter((q) => validateQuestion(q) === null),
        custom: false
      };
    })
  );
  return { version: index.version, categories };
}

/**
 * Import pliku JSON z telefonu. Obsługiwane formaty:
 *  1) { "id": "linux", "name": "Linux", "questions": [ ... ] }
 *  2) [ { "id": "linux", "name": "Linux", "questions": [...] }, ... ]
 * Jeśli kategoria o tym id już była zaimportowana – pytania o tych samych id są nadpisywane, nowe dopisywane.
 */
export function importCategoriesFromJson(text: string): { added: number; errors: string[] } {
  const parsed = JSON.parse(text) as unknown;
  const list = Array.isArray(parsed) ? parsed : [parsed];
  const custom = loadCustomCategories();
  const errors: string[] = [];
  let added = 0;

  for (const raw of list) {
    const c = raw as Partial<Category>;
    if (!c || typeof c.id !== 'string' || typeof c.name !== 'string' || !Array.isArray(c.questions)) {
      errors.push('Kategoria musi mieć pola "id", "name" i "questions"');
      continue;
    }
    const valid: Question[] = [];
    for (const q of c.questions) {
      const err = validateQuestion(q);
      if (err) errors.push(err);
      else valid.push(q as Question);
    }
    let target = custom.find((x) => x.id === c.id);
    if (!target) {
      target = { id: c.id, name: c.name, description: c.description, questions: [], custom: true };
      custom.push(target);
    }
    target.name = c.name;
    for (const q of valid) {
      const i = target.questions.findIndex((x) => x.id === q.id);
      if (i >= 0) target.questions[i] = q;
      else target.questions.push(q);
      added++;
    }
  }
  saveCustomCategories(custom);
  return { added, errors };
}

export function deleteCustomCategory(id: string): void {
  saveCustomCategories(loadCustomCategories().filter((c) => c.id !== id));
}
