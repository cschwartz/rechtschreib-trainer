import type { DictationItem } from "../types";

const quoteAndDashVariants = /[\u2018\u2019\u201A\u201B\u2032\u02BC]/g;
const doubleQuoteVariants = /[\u201C\u201D\u201E\u201F\u2033]/g;
const dashVariants = /[\u2010-\u2015\u2212]/g;

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFC")
    .replace(quoteAndDashVariants, "'")
    .replace(doubleQuoteVariants, '"')
    .replace(dashVariants, "-")
    .replace(/\s+/gu, " ")
    .trim();
}

function comparable(value: string, item: DictationItem): string {
  const normalized = normalizeAnswer(value);
  const punctuationRelaxed =
    item.gradingMode === "relaxed-punctuation" && item.subtype === "sentence";
  const punctuationHandled = punctuationRelaxed
    ? normalized.replace(/[.,!?;:…()[\]{}"'“”‘’\-–—]/gu, "").replace(/\s+/gu, " ").trim()
    : normalized;
  return item.subtype === "word" ? punctuationHandled.toLocaleLowerCase("de-DE") : punctuationHandled;
}

export function gradeDictationAnswer(answer: string, item: DictationItem): boolean {
  const actual = comparable(answer, item);
  return item.acceptedAnswers.some((accepted) => comparable(accepted, item) === actual);
}

export function isFillAnswerCorrect(answer: string, correctOption: string): boolean {
  return normalizeAnswer(answer) === normalizeAnswer(correctOption);
}

