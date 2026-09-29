import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dataPath = fileURLToPath(new URL('../src/data/spelling-items.json', import.meta.url));
const supportedKinds = new Set(['dictation', 'fill', 'find-mistake', 'capitalization']);
const supportedCategories = new Set([
  'ie-ei',
  'ä-e',
  'äu-eu',
  's-ss-ß',
  'doppelkonsonanten',
  'dehnungs-h',
  'groß-kleinschreibung',
  'das-dass',
  'ck-tz',
  'f-v',
  'endungen',
  'allgemein',
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validate(data) {
  const errors = [];

  if (!isRecord(data)) {
    return { errors: ['Root must be a JSON object.'] };
  }
  if (!isRecord(data.meta)) {
    errors.push('meta must be a JSON object.');
  }
  if (!Array.isArray(data.items)) {
    errors.push('items must be an array.');
    return { errors };
  }

  const ids = new Set();
  const distribution = {};

  data.items.forEach((item, index) => {
    const label = `items[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${label} must be a JSON object.`);
      return;
    }

    if (!nonEmptyString(item.id)) {
      errors.push(`${label}.id must be a non-empty string.`);
    } else if (ids.has(item.id)) {
      errors.push(`${label}.id "${item.id}" is duplicated.`);
    } else {
      ids.add(item.id);
    }

    if (!supportedCategories.has(item.category)) {
      errors.push(`${label}.category "${item.category}" is unsupported.`);
    } else {
      distribution[item.category] = (distribution[item.category] ?? 0) + 1;
    }

    if (!supportedKinds.has(item.kind)) {
      errors.push(`${label}.kind "${item.kind}" is unsupported.`);
    }
    if (!Number.isInteger(item.difficulty) || item.difficulty < 1 || item.difficulty > 5) {
      errors.push(`${label}.difficulty must be an integer from 1 to 5.`);
    }
    if (!Array.isArray(item.tags) || item.tags.length === 0 || !item.tags.every(nonEmptyString)) {
      errors.push(`${label}.tags must be a non-empty array of non-empty strings.`);
    }
    if (!nonEmptyString(item.explanation)) {
      errors.push(`${label}.explanation must be a non-empty string.`);
    }
    if (!nonEmptyString(item.source)) {
      errors.push(`${label}.source must be a non-empty string.`);
    }

    switch (item.kind) {
      case 'dictation':
        if (!['word', 'sentence'].includes(item.subtype)) {
          errors.push(`${label}.subtype must be "word" or "sentence".`);
        }
        if (!nonEmptyString(item.promptText)) {
          errors.push(`${label}.promptText must be a non-empty string.`);
        }
        if (
          !Array.isArray(item.acceptedAnswers) ||
          item.acceptedAnswers.length === 0 ||
          !item.acceptedAnswers.every(nonEmptyString)
        ) {
          errors.push(`${label}.acceptedAnswers must be a non-empty array of non-empty strings.`);
        }
        if (
          item.gradingMode !== undefined &&
          !['strict', 'relaxed-punctuation'].includes(item.gradingMode)
        ) {
          errors.push(`${label}.gradingMode must be "strict" or "relaxed-punctuation".`);
        }
        break;
      case 'fill':
        if (!nonEmptyString(item.sentence)) {
          errors.push(`${label}.sentence must be a non-empty string.`);
        }
        if (
          !Array.isArray(item.options) ||
          item.options.length === 0 ||
          !item.options.every(nonEmptyString)
        ) {
          errors.push(`${label}.options must be a non-empty array of non-empty strings.`);
        } else if (!item.options.includes(item.correctOption)) {
          errors.push(`${label}.correctOption must match one of its options.`);
        }
        if (!nonEmptyString(item.correctOption)) {
          errors.push(`${label}.correctOption must be a non-empty string.`);
        }
        break;
      case 'find-mistake':
        if (!nonEmptyString(item.sentence)) {
          errors.push(`${label}.sentence must be a non-empty string.`);
        }
        if (!nonEmptyString(item.wrongToken)) {
          errors.push(`${label}.wrongToken must be a non-empty string.`);
        } else if (typeof item.sentence === 'string' && !item.sentence.includes(item.wrongToken)) {
          errors.push(`${label}.wrongToken must appear in sentence.`);
        }
        break;
      case 'capitalization':
        if (!nonEmptyString(item.sentence)) {
          errors.push(`${label}.sentence must be a non-empty string.`);
        }
        if (
          !Array.isArray(item.correctWords) ||
          item.correctWords.length === 0 ||
          !item.correctWords.every(nonEmptyString)
        ) {
          errors.push(`${label}.correctWords must be a non-empty array of non-empty strings.`);
        } else if (
          typeof item.sentence === 'string' &&
          !item.correctWords.every((word) => item.sentence.includes(word))
        ) {
          errors.push(`${label}.correctWords must each appear in sentence.`);
        }
        break;
    }
  });

  return { errors, distribution };
}

async function main() {
  let data;
  try {
    data = JSON.parse(await readFile(dataPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Data file not found: ${path.relative(process.cwd(), dataPath)}. Supply the complete dataset and retry.`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${path.relative(process.cwd(), dataPath)}: ${error.message}`);
    }
    throw error;
  }

  const { errors, distribution } = validate(data);
  if (errors.length > 0) {
    throw new Error(`Spelling data validation failed:\n- ${errors.join('\n- ')}`);
  }

  data.meta.totalItems = data.items.length;
  data.meta.distributionByCategory = Object.fromEntries(
    Object.entries(distribution).sort(([a], [b]) => a.localeCompare(b)),
  );

  await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  const reread = JSON.parse(await readFile(dataPath, 'utf8'));
  const expectedDistribution = data.meta.distributionByCategory;
  if (
    reread.meta.totalItems !== reread.items.length ||
    JSON.stringify(reread.meta.distributionByCategory) !== JSON.stringify(expectedDistribution)
  ) {
    throw new Error('Metadata verification failed after writing spelling data.');
  }

  console.log(`Validated ${reread.meta.totalItems} spelling items.`);
  console.log(`Category counts: ${JSON.stringify(reread.meta.distributionByCategory)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
