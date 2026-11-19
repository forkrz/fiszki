// Sprawdza bazę pytań przed buildem. Uruchamiane automatycznie w `npm run build` (także na GitHubie).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'public', 'questions');
const errors = [];
let total = 0;

const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
if (!Array.isArray(index.categories)) errors.push('index.json: brak tablicy "categories"');

const catIds = new Set();
for (const cat of index.categories ?? []) {
  if (!cat.id || !cat.name || !cat.file) errors.push(`index.json: kategoria wymaga id, name, file (${JSON.stringify(cat)})`);
  if (catIds.has(cat.id)) errors.push(`index.json: powtórzone id kategorii "${cat.id}"`);
  catIds.add(cat.id);

  const path = join(dir, cat.file);
  if (!existsSync(path)) {
    errors.push(`brak pliku ${cat.file}`);
    continue;
  }
  let questions;
  try {
    questions = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    errors.push(`${cat.file}: niepoprawny JSON – ${e.message}`);
    continue;
  }
  const ids = new Set();
  questions.forEach((q, i) => {
    const where = `${cat.file} #${i + 1} (${q.id ?? 'bez id'})`;
    if (!q.id) errors.push(`${where}: brak id`);
    else if (ids.has(q.id)) errors.push(`${where}: powtórzone id`);
    ids.add(q.id);
    if (!q.question) errors.push(`${where}: brak treści pytania`);
    if (!Array.isArray(q.answers) || q.answers.length !== 4) errors.push(`${where}: muszą być dokładnie 4 odpowiedzi`);
    else if (new Set(q.answers).size !== 4) errors.push(`${where}: odpowiedzi się powtarzają`);
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) errors.push(`${where}: "correct" musi być 0–3`);
  });
  total += questions.length;
  console.log(`✔ ${cat.name}: ${questions.length} pytań`);
}

if (errors.length) {
  console.error('\n✘ Błędy w bazie pytań:\n - ' + errors.join('\n - '));
  process.exit(1);
}
console.log(`Razem: ${total} pytań w ${catIds.size} kategoriach.`);
