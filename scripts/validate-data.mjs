import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataPath = resolve(root, "src/data/spelling-items.json");
const validKinds = new Set(["dictation", "fill-blank", "find-mistake", "capitalization"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateDataset(data) {
  const errors = [];
  if (!isObject(data)) return ["Dataset must be a JSON object."];
  if (!isObject(data.meta)) errors.push("meta must be an object.");
  if (!Array.isArray(data.items)) errors.push("items must be an array.");
  if (!isObject(data.meta) || !Array.isArray(data.items)) return errors;

  const categories = Object.keys(isObject(data.meta.distributionByCategory)
    ? data.meta.distributionByCategory
    : {});
  if (!categories.length) errors.push("meta.distributionByCategory must define at least one category.");
  if (!text(data.meta.schemaVersion)) errors.push("meta.schemaVersion must be a non-empty string.");
  if (!text(data.meta.language)) errors.push("meta.language must be a non-empty string.");
  if (!text(data.meta.gradeTarget)) errors.push("meta.gradeTarget must be a non-empty string.");

  const ids = new Set();
  const observed = new Map();
  data.items.forEach((item, index) => {
    const prefix = `items[${index}]`;
    if (!isObject(item)) {
      errors.push(`${prefix} must be an object.`);
      return;
    }
    if (!text(item.id)) errors.push(`${prefix}.id must be a non-empty string.`);
    else if (ids.has(item.id)) errors.push(`Duplicate item id "${item.id}".`);
    else ids.add(item.id);
    if (!validKinds.has(item.kind)) errors.push(`${prefix}.kind is invalid.`);
    if (!text(item.category) || !categories.includes(item.category)) {
      errors.push(`${prefix}.category must match a category in meta.distributionByCategory.`);
    } else {
      observed.set(item.category, (observed.get(item.category) ?? 0) + 1);
    }
    if (!Number.isInteger(item.difficulty) || item.difficulty < 1 || item.difficulty > 5) {
      errors.push(`${prefix}.difficulty must be an integer from 1 to 5.`);
    }
    for (const field of ["tags", "explanation", "source"]) {
      if (field === "tags" ? !Array.isArray(item.tags) || !item.tags.every(text) : !text(item[field])) {
        errors.push(`${prefix}.${field} is required and must have the expected shape.`);
      }
    }
    if (item.kind === "dictation") {
      if (!["word", "sentence"].includes(item.subtype)) errors.push(`${prefix}.subtype must be word or sentence.`);
      if (!text(item.promptText)) errors.push(`${prefix}.promptText is required.`);
      if (!Array.isArray(item.acceptedAnswers) || !item.acceptedAnswers.length || !item.acceptedAnswers.every(text)) {
        errors.push(`${prefix}.acceptedAnswers must be a non-empty array of strings.`);
      }
      if (!["strict", "relaxed-punctuation"].includes(item.gradingMode)) {
        errors.push(`${prefix}.gradingMode is invalid.`);
      }
      if (item.subtype === "word" && item.gradingMode === "relaxed-punctuation") {
        errors.push(`${prefix} word dictation cannot use relaxed-punctuation grading.`);
      }
    } else if (item.kind === "fill-blank") {
      if (!text(item.promptMasked)) errors.push(`${prefix}.promptMasked is required.`);
      if (!Array.isArray(item.options) || item.options.length < 2 || !item.options.every(text)) {
        errors.push(`${prefix}.options must contain at least two non-empty strings.`);
      } else if (!item.options.includes(item.correctOption)) {
        errors.push(`${prefix}.correctOption must be included in options.`);
      }
      if (!text(item.correctOption)) errors.push(`${prefix}.correctOption is required.`);
      if (!text(item.solutionWord)) errors.push(`${prefix}.solutionWord is required.`);
    } else if (item.kind === "find-mistake") {
      if (!text(item.sentence) || !text(item.wrongToken) || !text(item.correctToken)) {
        errors.push(`${prefix}.sentence, wrongToken, and correctToken are required.`);
      } else {
        const occurrences = item.sentence.split(item.wrongToken).length - 1;
        const tokenized = [...item.sentence.matchAll(/\p{L}[\p{L}\p{M}'’\-]*/gu)].map((match) => match[0]);
        if (occurrences !== 1 || !tokenized.includes(item.wrongToken)) {
          errors.push(`${prefix}.wrongToken must occur exactly once as a whole word in sentence.`);
        }
      }
    } else if (item.kind === "capitalization") {
      if (!text(item.sentence)) errors.push(`${prefix}.sentence is required.`);
      if (!Array.isArray(item.correctWords) || !item.correctWords.length || !item.correctWords.every(text)) {
        errors.push(`${prefix}.correctWords must be a non-empty array of strings.`);
      } else if (text(item.sentence)) {
        const words = [...item.sentence.matchAll(/\p{L}[\p{L}\p{M}'’\-]*/gu)].map((match) => match[0].toLocaleLowerCase("de-DE"));
        let cursor = 0;
        for (const expected of item.correctWords) {
          const found = words.findIndex((word, index) =>
            index >= cursor && word === expected.toLocaleLowerCase("de-DE"),
          );
          if (found < 0) {
            errors.push(`${prefix}.correctWords entry "${expected}" is not present in sentence in order.`);
            break;
          }
          cursor = found + 1;
        }
      }
    }
  });

  if (data.meta.totalItems !== data.items.length) {
    errors.push(`meta.totalItems is ${data.meta.totalItems}, but items contains ${data.items.length}.`);
  }
  for (const category of categories) {
    if (data.meta.distributionByCategory[category] !== (observed.get(category) ?? 0)) {
      errors.push(`meta.distributionByCategory.${category} is stale; expected ${observed.get(category) ?? 0}.`);
    }
  }
  for (const category of observed.keys()) {
    if (!categories.includes(category)) errors.push(`Category "${category}" is missing from metadata.`);
  }
  return errors;
}

export function updateMetadata(data) {
  if (!isObject(data) || !Array.isArray(data.items) || !isObject(data.meta)) {
    throw new Error("Cannot update metadata: expected meta object and items array.");
  }
  data.meta.totalItems = data.items.length;
  data.meta.distributionByCategory = data.items.reduce((counts, item) => {
    if (isObject(item) && text(item.category)) counts[item.category] = (counts[item.category] ?? 0) + 1;
    return counts;
  }, {});
  return data;
}

async function main() {
  let data;
  try {
    data = JSON.parse(await readFile(dataPath, "utf8"));
  } catch (error) {
    console.error(`Unable to parse ${dataPath}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  if (process.argv.includes("--update-metadata")) {
    try {
      data = updateMetadata(data);
      await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`);
      console.log("Updated item count and category distribution.");
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
  }
  const errors = validateDataset(data);
  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log(`Validated ${data.items.length} spelling items.`);
}

if (process.argv[1]?.endsWith("/scripts/validate-data.mjs")) await main();
