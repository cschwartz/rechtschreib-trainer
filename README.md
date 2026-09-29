# rechtschreib-trainer
A "Duolingo for German spelling" web app for 6th-grade Rechtschreibung practice — dictation with TTS, fill-in-the-blank, find-the-mistake, capitalization. Single self-contained HTML file, works offline.

## Spelling data maintenance

Run `npm run data:update-and-validate` to validate `src/data/spelling-items.json` and update its item and category counts. The one-off script changes metadata only; it does not rewrite item content.
