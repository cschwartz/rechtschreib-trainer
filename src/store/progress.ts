import type { ExerciseMode, ProgressState, SpellingItem } from "../types";

export const STORAGE_KEY = "rechtschreib-trainer-progress-v1";

const modes: ExerciseMode[] = ["dictation", "fill-blank", "find-mistake", "capitalization"];

export function emptyProgress(): ProgressState {
  return {
    xp: 0,
    streak: 0,
    bestStreak: 0,
    answered: 0,
    correct: 0,
    byCategory: {},
    byMode: {
      dictation: { answered: 0, correct: 0 },
      "fill-blank": { answered: 0, correct: 0 },
      "find-mistake": { answered: 0, correct: 0 },
      capitalization: { answered: 0, correct: 0 },
    },
  };
}

export function readProgress(storage: Pick<Storage, "getItem"> = localStorage): ProgressState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const value = JSON.parse(raw) as Partial<ProgressState>;
    if (
      typeof value.xp !== "number" ||
      typeof value.streak !== "number" ||
      typeof value.bestStreak !== "number" ||
      typeof value.answered !== "number" ||
      typeof value.correct !== "number" ||
      !value.byCategory ||
      !value.byMode ||
      !modes.every((mode) => value.byMode?.[mode] &&
        typeof value.byMode[mode].answered === "number" &&
        typeof value.byMode[mode].correct === "number")
    ) return emptyProgress();
    return value as ProgressState;
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(
  progress: ProgressState,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Progress remains available for the current session when storage is unavailable.
  }
}

export function recordAnswer(
  current: ProgressState,
  item: SpellingItem,
  correct: boolean,
): ProgressState {
  const category = current.byCategory[item.category] ?? { answered: 0, correct: 0 };
  const mode = current.byMode[item.kind] ?? { answered: 0, correct: 0 };
  const streak = correct ? current.streak + 1 : 0;
  return {
    ...current,
    xp: current.xp + (correct ? 10 : 0),
    streak,
    bestStreak: Math.max(current.bestStreak, streak),
    answered: current.answered + 1,
    correct: current.correct + Number(correct),
    byCategory: {
      ...current.byCategory,
      [item.category]: {
        answered: category.answered + 1,
        correct: category.correct + Number(correct),
      },
    },
    byMode: {
      ...current.byMode,
      [item.kind]: {
        answered: mode.answered + 1,
        correct: mode.correct + Number(correct),
      },
    },
  };
}
