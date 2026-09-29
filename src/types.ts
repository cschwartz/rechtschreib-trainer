export type ExerciseKind = "dictation" | "fill-blank" | "find-mistake" | "capitalization";
export type DictationSubtype = "word" | "sentence";
export type GradingMode = "strict" | "relaxed-punctuation";

export interface BaseItem {
  id: string;
  kind: ExerciseKind;
  category: string;
  difficulty: number;
  tags: string[];
  explanation: string;
  source: string;
}

export interface DictationItem extends BaseItem {
  kind: "dictation";
  subtype: DictationSubtype;
  promptText: string;
  acceptedAnswers: string[];
  gradingMode: GradingMode;
}

export interface FillBlankItem extends BaseItem {
  kind: "fill-blank";
  promptMasked: string;
  options: string[];
  correctOption: string;
  solutionWord: string;
}

export interface FindMistakeItem extends BaseItem {
  kind: "find-mistake";
  sentence: string;
  wrongToken: string;
  correctToken: string;
}

export interface CapitalizationItem extends BaseItem {
  kind: "capitalization";
  sentence: string;
  correctWords: string[];
}

export type SpellingItem =
  | DictationItem
  | FillBlankItem
  | FindMistakeItem
  | CapitalizationItem;

export interface SpellingDataset {
  meta: {
    schemaVersion: string;
    language: string;
    gradeTarget: string;
    totalItems: number;
    distributionByCategory: Record<string, number>;
  };
  items: SpellingItem[];
}

export type ExerciseMode = ExerciseKind;

export interface ProgressState {
  xp: number;
  streak: number;
  bestStreak: number;
  answered: number;
  correct: number;
  byCategory: Record<string, { answered: number; correct: number }>;
  byMode: Record<ExerciseMode, { answered: number; correct: number }>;
}
