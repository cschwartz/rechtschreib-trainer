import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dataPath = fileURLToPath(
  new URL("../src/data/spelling-items.json", import.meta.url),
);

const kinds = new Set([
  "dictation",
  "fill-blank",
  "find-mistake",
  "capitalization",
]);
const categories = [
  "double-consonant",
  "ie-i",
  "umlaut-e",
  "umlaut-eu",
  "s-ss-ß",
  "silent-h",
  "das-dass",
  "capitalization",
  "mixed",
];

const requiredByKind = {
  "fill-blank": [
    "promptMasked",
    "options",
    "correctOption",
    "solutionWord",
  ],
  dictation: ["subtype", "promptText", "acceptedAnswers"],
  "find-mistake": ["sentence", "wrongToken", "correctToken"],
  capitalization: ["sentence", "correctWords"],
};
const commonFields = [
  "id",
  "kind",
  "category",
  "difficulty",
  "tags",
  "explanation",
  "source",
];
const errors = [];
const warnings = [];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireNonEmptyString(item, field, label) {
  if (typeof item[field] !== "string" || item[field].trim() === "") {
    errors.push(`${label}.${field} must be a non-empty string`);
    return false;
  }
  return true;
}

function requireStringArray(item, field, label) {
  if (
    !Array.isArray(item[field]) ||
    item[field].length === 0 ||
    item[field].some((value) => typeof value !== "string" || value.trim() === "")
  ) {
    errors.push(`${label}.${field} must be a non-empty array of non-empty strings`);
    return false;
  }
  return true;
}

function sentenceWords(sentence) {
  return sentence.toLocaleLowerCase("de-DE").match(/[\p{L}\p{M}]+/gu) ?? [];
}

function validateItem(item, index, ids) {
  const label = `items[${index}]`;
  if (!isObject(item)) {
    errors.push(`${label} must be an object`);
    return;
  }

  for (const field of commonFields) {
    if (!Object.hasOwn(item, field)) {
      errors.push(`${label}.${field} is required`);
    }
  }
  if (requireNonEmptyString(item, "id", label)) {
    if (ids.has(item.id)) {
      errors.push(`${label}.id duplicates "${item.id}"`);
    }
    ids.add(item.id);
  }
  if (!kinds.has(item.kind)) {
    errors.push(`${label}.kind has unsupported value ${JSON.stringify(item.kind)}`);
    return;
  }
  if (!categories.includes(item.category)) {
    errors.push(
      `${label}.category has unsupported value ${JSON.stringify(item.category)}`,
    );
  }
  if (!Number.isInteger(item.difficulty) || item.difficulty < 1 || item.difficulty > 5) {
    errors.push(`${label}.difficulty must be an integer from 1 to 5`);
  }
  requireStringArray(item, "tags", label);
  requireNonEmptyString(item, "explanation", label);
  requireNonEmptyString(item, "source", label);

  for (const field of requiredByKind[item.kind]) {
    if (!Object.hasOwn(item, field)) {
      errors.push(`${label}.${field} is required for ${item.kind}`);
    }
  }

  if (item.kind === "fill-blank") {
    const hasPrompt = requireNonEmptyString(item, "promptMasked", label);
    const hasOptions = requireStringArray(item, "options", label);
    const hasCorrectOption = requireNonEmptyString(item, "correctOption", label);
    const hasSolutionWord = requireNonEmptyString(item, "solutionWord", label);
    if (hasOptions && hasCorrectOption && !item.options.includes(item.correctOption)) {
      errors.push(`${label}.correctOption must be included in options`);
    }
    if (hasPrompt && hasCorrectOption && hasSolutionWord) {
      const completedPrompt = item.promptMasked.replace(/[_…]+/u, item.correctOption);
      if (
        completedPrompt === item.promptMasked ||
        !sentenceWords(completedPrompt).includes(
          item.solutionWord.toLocaleLowerCase("de-DE"),
        )
      ) {
        warnings.push(
          `${item.id}: completed fill-blank prompt may not form solutionWord "${item.solutionWord}"`,
        );
      }
    }
  } else if (item.kind === "dictation") {
    if (!["word", "sentence"].includes(item.subtype)) {
      errors.push(`${label}.subtype must be "word" or "sentence"`);
    }
    requireNonEmptyString(item, "promptText", label);
    requireStringArray(item, "acceptedAnswers", label);
    if (
      Object.hasOwn(item, "gradingMode") &&
      !["strict", "relaxed-punctuation"].includes(item.gradingMode)
    ) {
      errors.push(
        `${label}.gradingMode must be "strict" or "relaxed-punctuation"`,
      );
    }
  } else if (item.kind === "find-mistake") {
    const hasSentence = requireNonEmptyString(item, "sentence", label);
    const hasWrongToken = requireNonEmptyString(item, "wrongToken", label);
    requireNonEmptyString(item, "correctToken", label);
    if (hasSentence && hasWrongToken && !item.sentence.includes(item.wrongToken)) {
      errors.push(`${label}.wrongToken must appear in sentence`);
    }
  } else {
    const hasSentence = requireNonEmptyString(item, "sentence", label);
    const hasCorrectWords = requireStringArray(item, "correctWords", label);
    if (hasSentence && hasCorrectWords) {
      const words = sentenceWords(item.sentence);
      for (const word of item.correctWords) {
        if (!words.includes(word.toLocaleLowerCase("de-DE"))) {
          errors.push(
            `${label}.correctWords contains "${word}", which is absent from sentence`,
          );
        }
      }
    }
  }
}

let raw;
let data;
try {
  raw = await readFile(dataPath, "utf8");
  data = JSON.parse(raw);
} catch (error) {
  console.error(`Unable to read or parse ${dataPath}: ${error.message}`);
  process.exitCode = 1;
}

if (data !== undefined) {
  if (!isObject(data)) {
    errors.push("root must be an object");
  } else {
    if (!isObject(data.meta)) {
      errors.push("meta must be an object");
    }
    if (!Array.isArray(data.items)) {
      errors.push("items must be an array");
    } else {
      const ids = new Set();
      data.items.forEach((item, index) => validateItem(item, index, ids));
    }
  }

  if (errors.length > 0) {
    console.error(`Validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    const distribution = Object.fromEntries(
      categories.map((category) => [
        category,
        data.items.filter((item) => item.category === category).length,
      ]),
    );
    const originalItems = JSON.stringify(data.items);
    data.meta.totalItems = data.items.length;
    data.meta.distributionByCategory = distribution;

    await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

    const verified = JSON.parse(await readFile(dataPath, "utf8"));
    if (
      verified.meta.totalItems !== data.items.length ||
      JSON.stringify(verified.meta.distributionByCategory) !==
        JSON.stringify(distribution) ||
      JSON.stringify(verified.items) !== originalItems
    ) {
      console.error("Metadata verification failed or item content changed");
      process.exitCode = 1;
    } else {
      console.log(`Validated ${verified.items.length} spelling items.`);
      console.log("Distribution by category:");
      for (const [category, count] of Object.entries(distribution)) {
        console.log(`- ${category}: ${count}`);
      }
      if (warnings.length > 0) {
        console.warn(`Semantic warnings (${warnings.length}; item content unchanged):`);
        for (const warning of warnings) console.warn(`- ${warning}`);
      }
    }
  }
}
