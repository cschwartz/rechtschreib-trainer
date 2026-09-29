import assert from "node:assert/strict";
import test from "node:test";
import { gradeDictationAnswer, normalizeAnswer } from "../src/engine/grading";
import { getCapitalizationTargets, submitExercise } from "../src/engine/exercises";
import { emptyProgress, readProgress, saveProgress } from "../src/store/progress";
import type { CapitalizationItem, DictationItem } from "../src/types";

const word: DictationItem = {
  id: "dict-test",
  kind: "dictation",
  category: "ie-i",
  difficulty: 1,
  tags: ["i oder ie"],
  explanation: "Testregel",
  source: "Test",
  subtype: "word",
  promptText: "Fliege",
  acceptedAnswers: ["Fliege"],
  gradingMode: "strict",
};

test("normalization unifies whitespace, German quote, and dash variants", () => {
  assert.equal(normalizeAnswer("  „Hallo“\u00a0–\tWelt  "), '"Hallo" - Welt');
});

test("word dictation ignores case but keeps umlaut and ß spelling strict", () => {
  assert.equal(gradeDictationAnswer("FLIEGE", word), true);
  assert.equal(gradeDictationAnswer("Fliege", { ...word, acceptedAnswers: ["Füße"] }), false);
});

test("sentence dictation preserves capitalization and can relax punctuation", () => {
  const sentence: DictationItem = {
    ...word,
    subtype: "sentence",
    promptText: "Die Vögel fliegen.",
    acceptedAnswers: ["Die Vögel fliegen."],
    gradingMode: "relaxed-punctuation",
  };
  assert.equal(gradeDictationAnswer("Die Vögel fliegen", sentence), true);
  assert.equal(gradeDictationAnswer("die Vögel fliegen.", sentence), false);
  assert.equal(gradeDictationAnswer("Die Vogel fliegen.", sentence), false);
});

test("dictation submission updates XP, streak, session correctness, and resets a missed streak", () => {
  const first = submitExercise(emptyProgress(), word, "Fliege");
  assert.equal(first.correct, true);
  assert.equal(first.progress.xp, 10);
  assert.equal(first.progress.streak, 1);
  const second = submitExercise(first.progress, word, "Flige");
  assert.equal(second.correct, false);
  assert.equal(second.progress.streak, 0);
  assert.equal(second.progress.answered, 2);
  assert.equal(second.progress.correct, 1);
  assert.equal(second.progress.byMode.dictation.answered, 2);
});

test("progress persistence round-trips and safely ignores unavailable or corrupt storage", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const result = submitExercise(emptyProgress(), word, "Fliege").progress;
  saveProgress(result, storage);
  assert.deepEqual(readProgress(storage), result);
  assert.deepEqual(readProgress({ getItem: () => "not-json" }), emptyProgress());
  assert.doesNotThrow(() => saveProgress(result, { setItem: () => { throw new Error("blocked"); } }));
});

test("capitalization target matching preserves target word positions", () => {
  const item: CapitalizationItem = {
    id: "capitalization-test",
    kind: "capitalization",
    category: "capitalization",
    difficulty: 1,
    tags: [],
    explanation: "Nomen schreibt man groß.",
    source: "Test",
    sentence: "der hund spielt im garten.",
    correctWords: ["Der", "Hund", "Garten"],
  };
  assert.deepEqual(getCapitalizationTargets(item), [0, 1, 4]);
});
