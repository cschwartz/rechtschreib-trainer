import type { CapitalizationItem, FindMistakeItem, ProgressState, SpellingItem } from "../types";
import { gradeDictationAnswer, isFillAnswerCorrect } from "./grading";
import { recordAnswer } from "../store/progress";

export function getCapitalizationTargets(item: CapitalizationItem): number[] {
  const tokens = [...item.sentence.matchAll(/\p{L}[\p{L}\p{M}'’\-]*/gu)];
  let cursor = 0;
  const targets: number[] = [];
  for (const expected of item.correctWords) {
    const expectedLower = expected.toLocaleLowerCase("de-DE");
    const index = tokens.findIndex((token, i) =>
      i >= cursor && token[0].toLocaleLowerCase("de-DE") === expectedLower,
    );
    if (index < 0) continue;
    targets.push(index);
    cursor = index + 1;
  }
  return targets;
}

export function checkExerciseAnswer(
  item: SpellingItem,
  answer: string,
  selectedTokens: number[] = [],
): boolean {
  switch (item.kind) {
    case "dictation":
      return gradeDictationAnswer(answer, item);
    case "fill-blank":
      return isFillAnswerCorrect(answer, item.correctOption);
    case "find-mistake":
      return selectedTokens.length === 1 &&
        answer === item.correctToken &&
        selectedTokens[0] >= 0;
    case "capitalization": {
      const expected = getCapitalizationTargets(item);
      return expected.length === selectedTokens.length &&
        expected.every((index) => selectedTokens.includes(index));
    }
  }
}

export function submitExercise(
  state: ProgressState,
  item: SpellingItem,
  answer: string,
  selectedTokens: number[] = [],
): { correct: boolean; progress: ProgressState } {
  const correct = checkExerciseAnswer(item, answer, selectedTokens);
  return { correct, progress: recordAnswer(state, item, correct) };
}
