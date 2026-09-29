# Wortwunder – Rechtschreibtrainer

An offline-first German spelling trainer for learners in grade 6. Practice dictation, spelling patterns, finding misspellings, and capitalization. This is a Rechtschreibung practice app, not a translation tool.

## Run and build

Requirements: Node.js 20 or newer.

```sh
npm install
npm run validate:data
npm test
npx tsc --noEmit
npm run build
```

Open `dist/index.html` directly in a browser. The build bundles the app, styles, and JSON exercises into one self-contained HTML file. The app makes no runtime network requests; dictation audio uses the browser's built-in Web Speech API and requires a German (`de-DE`) speech voice to be available. If speech synthesis is unavailable, use the other practice modes.

## Data maintenance

`src/data/spelling-items.json` is the authoritative exercise data. The validator checks item shape and required fields by exercise kind, IDs, categories, difficulty, answer relationships, and metadata totals.

After adding or changing items, run:

```sh
npm run update:data
npm run validate:data
```

The maintenance command updates `meta.totalItems` and `meta.distributionByCategory`; it does not rewrite exercise content. Keep semantic and pedagogical reviews separate from structural validation.

## Progress and practice

XP, streaks, answer totals, and category/mode accuracy are saved in browser `localStorage`. Dictation inputs disable browser spelling, autocorrect, autocomplete, and automatic capitalization so the browser does not reveal spelling suggestions.
