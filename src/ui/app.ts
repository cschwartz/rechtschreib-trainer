import dataset from "../data/spelling-items.json";
import type {
  CapitalizationItem,
  DictationItem,
  ExerciseMode,
  FindMistakeItem,
  ProgressState,
  SpellingItem,
} from "../types";
import { getCapitalizationTargets, submitExercise } from "../engine/exercises";
import { readProgress, saveProgress } from "../store/progress";

const modes: { id: ExerciseMode; title: string; icon: string; description: string }[] = [
  { id: "dictation", title: "Diktat", icon: "🎧", description: "Höre genau zu und schreibe das Wort oder den Satz richtig." },
  { id: "fill-blank", title: "Lücken füllen", icon: "🧩", description: "Finde die passende Schreibweise für die Lücke." },
  { id: "find-mistake", title: "Fehler finden", icon: "🔎", description: "Entdecke das falsch geschriebene Wort und verbessere es." },
  { id: "capitalization", title: "Großschreibung", icon: "🔠", description: "Tippe alle Wörter an, die großgeschrieben werden." },
];

const categoryNames: Record<string, string> = {
  "double-consonant": "Doppelkonsonanten",
  "ie-i": "i oder ie",
  "umlaut-e": "ä oder e",
  "umlaut-eu": "äu oder eu",
  "s-ss-ß": "s, ss oder ß",
  "silent-h": "Dehnungs-h",
  "das-dass": "das oder dass",
  capitalization: "Großschreibung",
  mixed: "Gemischte Übungen",
};

interface AppState {
  mode: ExerciseMode | null;
  category: string;
  item: SpellingItem | null;
  answer: string;
  selected: Set<number>;
  feedback: boolean | null;
  progress: ProgressState;
  seen: Set<string>;
  sessionAnswered: number;
  sessionCorrect: number;
  slow: boolean;
  finished: boolean;
}

const allItems = dataset.items as SpellingItem[];
const sessionLength = 10;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] as string);
}

function label(category: string): string {
  return categoryNames[category] ?? category;
}

function textTokens(sentence: string): string[] {
  return [...sentence.matchAll(/\p{L}[\p{L}\p{M}'’\-]*/gu)].map((match) => match[0]);
}

function exactWrongTokenIndex(item: FindMistakeItem): number {
  return textTokens(item.sentence).findIndex((word) => word === item.wrongToken);
}

function capitalizationSentence(item: CapitalizationItem, selected: Set<number>): string {
  let index = 0;
  return escapeHtml(item.sentence).replace(/\p{L}[\p{L}\p{M}'’\-]*/gu, (word) => {
    const current = index++;
    const active = selected.has(current);
    return `<button class="word-chip${active ? " selected" : ""}" data-token="${current}" aria-pressed="${active}">${word}</button>`;
  });
}

function mistakeSentence(item: FindMistakeItem, selected: Set<number>): string {
  let index = 0;
  return escapeHtml(item.sentence).replace(/\p{L}[\p{L}\p{M}'’\-]*/gu, (word) => {
    const current = index++;
    const active = selected.has(current);
    return `<button class="word-chip${active ? " selected" : ""}" data-token="${current}" aria-pressed="${active}">${word}</button>`;
  });
}

function feedbackCorrection(item: SpellingItem): string {
  switch (item.kind) {
    case "dictation": return item.acceptedAnswers[0];
    case "fill-blank": return item.solutionWord;
    case "find-mistake": return item.correctToken;
    case "capitalization": return item.correctWords.join(", ");
  }
}

export function startApp(root: HTMLElement): void {
  const state: AppState = {
    mode: null,
    category: "all",
    item: null,
    answer: "",
    selected: new Set(),
    feedback: null,
    progress: readProgress(),
    seen: new Set(),
    sessionAnswered: 0,
    sessionCorrect: 0,
    slow: false,
    finished: false,
  };

  const speak = (): void => {
    if (!state.item || state.item.kind !== "dictation" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(state.item.promptText);
    utterance.lang = "de-DE";
    utterance.rate = state.slow ? 0.7 : 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const nextItem = (): void => {
    if (state.sessionAnswered >= sessionLength) {
      state.finished = true;
      state.item = null;
      render();
      return;
    }
    const candidates = allItems.filter((item) =>
      item.kind === state.mode &&
      (state.category === "all" || item.category === state.category) &&
      !state.seen.has(item.id),
    );
    if (!candidates.length) {
      state.seen.clear();
      candidates.push(...allItems.filter((item) =>
        item.kind === state.mode &&
        (state.category === "all" || item.category === state.category),
      ));
    }
    if (!candidates.length) {
      state.item = null;
      render();
      return;
    }
    state.item = candidates[Math.floor(Math.random() * candidates.length)];
    state.seen.add(state.item.id);
    state.answer = "";
    state.selected.clear();
    state.feedback = null;
    render();
    if (state.item.kind === "dictation") speak();
    root.querySelector<HTMLInputElement>("#answer")?.focus();
  };

  const begin = (mode: ExerciseMode): void => {
    state.mode = mode;
    state.sessionAnswered = 0;
    state.sessionCorrect = 0;
    state.seen.clear();
    state.finished = false;
    nextItem();
  };

  const submit = (): void => {
    if (!state.item || state.feedback !== null) return;
    const result = submitExercise(state.progress, state.item, state.answer, [...state.selected]);
    state.progress = result.progress;
    state.feedback = result.correct;
    state.sessionAnswered += 1;
    state.sessionCorrect += Number(result.correct);
    saveProgress(state.progress);
    if (state.item.kind === "dictation" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    render();
  };

  const renderDashboard = (): string => {
    const categories = [...new Set(allItems.map((item) => item.category))].sort();
    const modeStats = modes.map(({ id, title }) => {
      const stats = state.progress.byMode[id];
      const percent = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0;
      return `<div class="progress-row"><div class="progress-label"><span>${title}</span><span>${stats.correct}/${stats.answered} richtig</span></div><div class="bar"><span style="width:${percent}%"></span></div></div>`;
    }).join("");
    const categoryStats = categories.map((category) => {
      const stats = state.progress.byCategory[category] ?? { answered: 0, correct: 0 };
      const percent = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0;
      return `<div class="progress-row"><div class="progress-label"><span>${escapeHtml(label(category))}</span><span>${stats.correct}/${stats.answered} richtig</span></div><div class="bar"><span style="width:${percent}%"></span></div></div>`;
    }).join("");
    return `<div class="shell">
      <header class="topbar"><div class="brand"><span class="brand-mark">W</span><span>Wortwunder</span></div>
        <div class="stats"><div class="stat"><strong>⭐ ${state.progress.xp}</strong><span>XP</span></div><div class="stat"><strong>🔥 ${state.progress.streak}</strong><span>Serie</span></div></div>
      </header>
      <section class="hero"><h1>Werde fit in Rechtschreibung!</h1><p>Übe Schritt für Schritt, höre genau hin und entdecke die richtigen Schreibweisen. Jede richtige Antwort bringt dich weiter.</p></section>
      <div class="section-head"><h2>Was möchtest du üben?</h2><label>Thema
        <select id="category" class="category-select"><option value="all">Alle Themen</option>${categories.map((category) => `<option value="${escapeHtml(category)}"${state.category === category ? " selected" : ""}>${escapeHtml(label(category))}</option>`).join("")}</select>
      </label></div>
      <div class="mode-grid">${modes.map((mode) => `<button class="mode-card" data-mode="${mode.id}"><span class="mode-icon">${mode.icon}</span><span><strong>${mode.title}</strong><small>${mode.description}</small></span></button>`).join("")}</div>
      <div class="section-head"><h2>Dein Lernstand</h2><span class="exercise-meta">${state.progress.correct} von ${state.progress.answered} richtig · Bestserie ${state.progress.bestStreak}</span></div>
      <section class="progress-card"><div class="progress-list">${modeStats}${categoryStats}</div></section>
    </div>`;
  };

  const renderExercise = (): string => {
    if (state.finished) {
      const percent = state.sessionAnswered
        ? Math.round((state.sessionCorrect / state.sessionAnswered) * 100)
        : 0;
      return `<div class="shell"><section class="exercise-card session-summary">
        <div class="score">${state.sessionCorrect}/${state.sessionAnswered}</div>
        <h2>Gut gemacht!</h2><p>Du hast ${percent}% richtig beantwortet und insgesamt ${state.sessionCorrect * 10} XP gesammelt.</p>
        <button class="primary-button" data-action="home">Zur Übersicht</button>
      </section></div>`;
    }
    const item = state.item;
    if (!item) {
      return `<div class="shell"><section class="exercise-card session-summary"><p class="empty">Für dieses Thema gibt es in diesem Modus noch keine Übungen.</p><button class="primary-button" data-action="home">Zur Übersicht</button></section></div>`;
    }
    const mode = modes.find((candidate) => candidate.id === state.mode)!;
    let exerciseBody = "";
    if (item.kind === "dictation") {
      exerciseBody = `<p class="prompt-label">Höre zu und schreibe, was du hörst.</p>
        <div class="actions"><button class="secondary-button" data-action="play">▶ Noch einmal anhören</button><label class="exercise-meta"><input type="checkbox" id="slow"${state.slow ? " checked" : ""}> Langsamer (0,7×)</label></div>
        <div class="input-row"><input id="answer" class="answer-input" type="text" value="${escapeHtml(state.answer)}" placeholder="Deine Antwort …" aria-label="Deine Antwort" spellcheck="false" autocorrect="off" autocomplete="off" autocapitalize="off"${state.feedback !== null ? " disabled" : ""}><button class="primary-button" data-action="submit"${state.feedback !== null ? " disabled" : ""}>Prüfen</button></div>`;
    } else if (item.kind === "fill-blank") {
      exerciseBody = `<p class="prompt-label">Welche Ergänzung ist richtig?</p><div class="prompt">${escapeHtml(item.promptMasked)}</div>
        <div class="options">${item.options.map((option) => `<button class="option-button${state.answer === option ? " selected" : ""}" data-option="${escapeHtml(option)}"${state.feedback !== null ? " disabled" : ""}>${escapeHtml(option)}</button>`).join("")}</div>
        <div class="actions"><button class="primary-button" data-action="submit"${state.feedback !== null || !state.answer ? " disabled" : ""}>Prüfen</button></div>`;
    } else if (item.kind === "find-mistake") {
      exerciseBody = `<p class="prompt-label">Tippe das falsch geschriebene Wort an und verbessere es.</p><div class="prompt sentence">${mistakeSentence(item, state.selected)}</div>
        <div class="input-row"><input id="answer" class="answer-input" type="text" value="${escapeHtml(state.answer)}" placeholder="Richtige Schreibweise …" aria-label="Korrigierte Schreibweise"${state.feedback !== null ? " disabled" : ""}><button class="primary-button" data-action="submit"${state.feedback !== null ? " disabled" : ""}>Prüfen</button></div>`;
    } else {
      exerciseBody = `<p class="prompt-label">Tippe alle Wörter an, die großgeschrieben werden müssen.</p><div class="prompt sentence">${capitalizationSentence(item, state.selected)}</div>
        <div class="actions"><button class="primary-button" data-action="submit"${state.feedback !== null ? " disabled" : ""}>Prüfen</button></div>`;
    }
    const feedback = state.feedback === null ? "" : `<div class="feedback ${state.feedback ? "correct" : "incorrect"}" role="status"><strong>${state.feedback ? "Richtig! Gut gemacht! 🎉" : "Noch nicht ganz."}</strong>${state.feedback ? "" : `<p>Richtige Antwort: <b>${escapeHtml(feedbackCorrection(item))}</b></p>`}<p>${escapeHtml(item.explanation)}</p></div><div class="next-row"><button class="primary-button" data-action="next">${state.sessionAnswered >= sessionLength ? "Zusammenfassung" : "Weiter"}</button></div>`;
    return `<div class="shell"><header class="practice-head"><button class="back-button" data-action="home">← Übersicht</button><span class="exercise-meta">Frage ${state.sessionAnswered + (state.feedback === null ? 1 : 0)} / ${sessionLength}</span></header>
      <section class="exercise-card"><div class="practice-head"><div><h1 class="exercise-title">${mode.title}</h1><span class="exercise-meta">${escapeHtml(label(item.category))} · Level ${item.difficulty}</span></div><span class="exercise-meta">${state.sessionCorrect} richtig</span></div>
      ${exerciseBody}${feedback}</section></div>`;
  };

  const render = (): void => {
    root.innerHTML = state.mode ? renderExercise() : renderDashboard();
    const answer = root.querySelector<HTMLInputElement>("#answer");
    if (answer && state.mode === "dictation") {
      answer.spellcheck = false;
      answer.autocomplete = "off";
      answer.setAttribute("spellcheck", "false");
      answer.setAttribute("autocorrect", "off");
      answer.setAttribute("autocomplete", "off");
      answer.setAttribute("autocapitalize", "off");
      Object.assign(answer, { autocorrect: "off", autocapitalize: "off" });
    }
  };

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.id === "answer") state.answer = target.value;
  });
  root.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.id === "category") {
      state.category = target.value;
    } else if (target instanceof HTMLInputElement && target.id === "slow") {
      state.slow = target.checked;
    }
    render();
  });
  root.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement && event.key === "Enter") submit();
  });
  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLElement>("button");
    if (!button) return;
    if (button.dataset.mode) {
      begin(button.dataset.mode as ExerciseMode);
    } else if (button.dataset.action === "home") {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      state.mode = null;
      state.item = null;
      state.finished = false;
      render();
    } else if (button.dataset.action === "play") {
      speak();
    } else if (button.dataset.action === "submit") {
      submit();
    } else if (button.dataset.action === "next") {
      nextItem();
    } else if (button.dataset.option !== undefined) {
      state.answer = button.dataset.option;
      render();
    } else if (button.dataset.token !== undefined && state.feedback === null) {
      const token = Number(button.dataset.token);
      if (state.item?.kind === "find-mistake") {
        state.selected.clear();
        if (token === exactWrongTokenIndex(state.item)) state.selected.add(token);
      } else {
        state.selected.has(token) ? state.selected.delete(token) : state.selected.add(token);
      }
      render();
    }
  });

  render();
}
