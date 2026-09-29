import assert from "node:assert/strict";
import test from "node:test";
import { updateMetadata, validateDataset } from "../scripts/validate-data.mjs";

function validItem(id = "dict-1") {
  return {
    id,
    kind: "dictation",
    category: "ie-i",
    difficulty: 1,
    tags: ["i oder ie"],
    explanation: "Langes i schreibt man oft ie.",
    source: "Test",
    subtype: "word",
    promptText: "Fliege",
    acceptedAnswers: ["Fliege"],
    gradingMode: "strict",
  };
}

function validDataset(items = [validItem()]) {
  return {
    meta: {
      schemaVersion: "1.0.0",
      language: "de-DE",
      gradeTarget: "6-gymnasium",
      totalItems: items.length,
      distributionByCategory: { "ie-i": items.length },
    },
    items,
  };
}

test("validates a complete data set", () => {
  assert.deepEqual(validateDataset(validDataset()), []);
});

test("reports duplicate IDs, invalid category/difficulty, and broken option relations", () => {
  const data = validDataset([
    { ...validItem(), kind: "fill-blank", promptMasked: "Fl_ ge", options: ["i", "ie"], correctOption: "e", solutionWord: "Fliege" },
    { ...validItem(), category: "unknown", difficulty: 6 },
  ]);
  const errors = validateDataset(data).join("\n");
  assert.match(errors, /Duplicate item id/);
  assert.match(errors, /category/);
  assert.match(errors, /difficulty/);
  assert.match(errors, /correctOption must be included/);
});

test("updates item total and category distribution", () => {
  const data = validDataset([validItem("a"), { ...validItem("b"), category: "mixed" }]);
  const updated = updateMetadata(data);
  assert.equal(updated.meta.totalItems, 2);
  assert.deepEqual(updated.meta.distributionByCategory, { "ie-i": 1, mixed: 1 });
  assert.deepEqual(validateDataset(updated), []);
});

test("rejects malformed JSON shapes without throwing", () => {
  assert.match(validateDataset([]).join(" "), /Dataset must be a JSON object/);
  assert.match(validateDataset({ meta: {}, items: {} }).join(" "), /items must be an array/);
});
