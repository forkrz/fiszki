export interface Question {
  id: string;
  question: string;
  answers: [string, string, string, string];
  /** Indeks poprawnej odpowiedzi: 0 = A, 1 = B, 2 = C, 3 = D */
  correct: number;
  explanation?: string;
  source?: string;
  topic?: string;
}

export interface CategoryMeta {
  id: string;
  name: string;
  description?: string;
  file: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  questions: Question[];
  custom: boolean;
}

export interface QuestionProgress {
  seen: number;
  correct: number;
  /** Pudełko Leitnera 1–5: im niższe, tym częściej pytanie wraca */
  box: number;
  lastWrong: boolean;
  last: number;
}

export type Progress = Record<string, QuestionProgress>;

export type SessionMode = 'mix' | 'wrong' | 'new' | 'weak';

/** Pytanie z przetasowanymi odpowiedziami na czas sesji */
export interface SessionCard {
  q: Question;
  categoryId: string;
  answers: string[];
  correct: number;
  chosen?: number;
}
