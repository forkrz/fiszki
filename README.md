# Fiszki – nauka do security (PWA, offline)

Fiszki ABCD z jedną poprawną odpowiedzią. Działa na telefonie jako zainstalowana aplikacja,
**w pełni offline** – pytania i postępy są w pamięci telefonu, aplikacja nic nigdzie nie wysyła.
GitHub Pages służy tylko do instalacji i dostarczania aktualizacji bazy pytań.

## Funkcje
- wybór kategorii (na start: **Sieci**, ~37 pytań pod Network+ N10-009) i tematu w kategorii
- tryby: losowo / najsłabsze najpierw (Leitner) / tylko błędne / tylko nowe; 10, 20 lub wszystkie pytania
- odpowiedzi tasowane przy każdym podejściu, wyjaśnienie po odpowiedzi, podsumowanie z listą pomyłek, „Powtórz błędne”
- import własnych pytań z pliku JSON na telefonie, eksport/import postępów (backup)
- baner „Dostępna nowa wersja” po wypchnięciu nowych pytań na GitHub

## Pierwsze uruchomienie (raz)

1. Utwórz na GitHubie puste repo, np. `fiszki` (może być prywatne tylko na płatnym planie – na darmowym Pages wymaga publicznego repo).
2. W katalogu projektu:
   ```bash
   git init -b main
   git add .
   git commit -m "Fiszki: pierwsza wersja"
   git remote add origin git@github.com:<twoj-login>/fiszki.git
   git push -u origin main
   ```
3. Na GitHubie: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Zakładka **Actions** – po ~1 min aplikacja jest pod `https://<twoj-login>.github.io/fiszki/`.
5. Na telefonie otwórz ten adres:
   - **Android (Chrome):** menu ⋮ → *Zainstaluj aplikację* / *Dodaj do ekranu głównego*
   - **iPhone (Safari):** Udostępnij → *Do ekranu początkowego*
6. Otwórz raz aplikację z ikony przy włączonym internecie – od tej chwili działa w trybie samolotowym.

## Aktualizacja bazy pytań

Pytania leżą w `public/questions/`:

```
public/questions/
├── index.json     ← lista kategorii + wersja bazy
└── sieci.json     ← pytania kategorii „Sieci”
```

**Dodanie pytań do istniejącej kategorii:** dopisz obiekty do `sieci.json`, podbij `version` w `index.json`
(np. na dzisiejszą datę), potem `git commit` + `git push`. GitHub Actions sprawdzi poprawność pytań
i opublikuje nową wersję. Na telefonie przy następnym otwarciu (z internetem) pojawi się baner
**„Dostępna nowa wersja” → Aktualizuj**. Postępy zostają.

**Nowa kategoria:** utwórz np. `public/questions/windows-ad.json` i dopisz do `index.json`:
```json
{ "id": "windows-ad", "name": "Windows / Active Directory", "description": "…", "file": "windows-ad.json" }
```

### Format pytania
```json
{
  "id": "por-012",
  "topic": "Porty i protokoły",
  "source": "Messer 1.4",
  "question": "Jaki port domyślnie używa TFTP?",
  "answers": ["UDP 69", "TCP 21", "UDP 123", "TCP 22"],
  "correct": 0,
  "explanation": "TFTP – UDP 69, prosty transfer plików bez uwierzytelniania."
}
```
- `id` – unikalne w kategorii, **nie zmieniaj go później** (po nim zapisywany jest postęp)
- `answers` – dokładnie 4; `correct` – indeks poprawnej: 0 = A, 1 = B, 2 = C, 3 = D
  (kolejność i tak jest tasowana w aplikacji, więc nie musisz pilnować rozkładu)
- `topic`, `source`, `explanation` – opcjonalne; `topic` daje filtr „Temat” w aplikacji

Przed pushem możesz sprawdzić bazę lokalnie: `npm run validate`.

### Import bez GitHuba (prosto z telefonu)
Ustawienia ⚙️ → *Importuj pytania z pliku*. Format pliku:
```json
{ "id": "linux", "name": "Linux", "questions": [ { "id": "l1", "question": "…", "answers": ["…","…","…","…"], "correct": 0 } ] }
```
Jeśli `id` kategorii jest takie samo jak wbudowanej (np. `sieci`), pytania dopiszą się do niej.
Takie pytania są tylko na tym telefonie – na stałe lepiej dodać je do repo.

### Prompt do generowania pytań (np. dla Claude)
> Na podstawie notatek z filmu Professora Messera [numer i tytuł] przygotuj 10 pytań w formacie JSON
> jak w README projektu Fiszki: pola id (prefiks `xxx-`, kolejne numery od NNN), topic, source,
> question, answers (4), correct (0–3), explanation (1–2 zdania). Po polsku, jedna jednoznacznie
> poprawna odpowiedź, sensowne dystraktory. Zwróć samą tablicę JSON.

## Praca lokalna (WSL)
```bash
npm install
npm run dev        # http://localhost:5173 – dostępne też z telefonu w tej samej sieci Wi-Fi
npm run build      # walidacja + typy + build do dist/
```
Jeśli telefon nie widzi serwera z WSL2: w `%UserProfile%\.wslconfig` dodaj
```
[wsl2]
networkingMode=mirrored
```
i zrób `wsl --shutdown`. (Service worker / instalacja działa tylko po HTTPS albo na localhost –
do testów instalacji używaj wersji z GitHub Pages.)

## Struktura
```
src/main.ts      – widoki i logika (vanilla TypeScript)
src/data.ts      – wczytywanie i walidacja pytań, import
src/storage.ts   – postępy i własne kategorie w localStorage
src/style.css    – wygląd (ciemny/jasny wg ustawień telefonu)
vite.config.ts   – konfiguracja PWA (manifest, cache offline)
.github/workflows/deploy.yml – automatyczny deploy na GitHub Pages
```
