# rechtschreib-trainer
A "Duolingo for German spelling" web app for 6th-grade Rechtschreibung practice — dictation with TTS, fill-in-the-blank, find-the-mistake, capitalization. Single self-contained HTML file, works offline.

## Spelling data metadata maintenance

Run `npm run data:update-and-validate` for the one-off spelling-data metadata maintenance command. It validates the dataset, updates only `meta.totalItems` and `meta.distributionByCategory`, and does not rewrite item content.
