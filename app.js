const sourceText = document.querySelector("#sourceText");
const formattedText = document.querySelector("#formattedText");
const markSpecialTokens = document.querySelector("#markSpecialTokens");
const modeSelect = document.querySelector("#modeSelect");
const characterSelect = document.querySelector("#characterSelect");
const characterField = document.querySelector("#characterField");
const sourceField = document.querySelector("#sourceField");
const outputField = document.querySelector("#outputField");
const convertButton = document.querySelector("#convertButton");
const editButton = document.querySelector("#editButton");
const viewTabs = document.querySelector("#viewTabs");
const outputTabButton = document.querySelector("#outputTabButton");
const studyTabButton = document.querySelector("#studyTabButton");
const studyPanel = document.querySelector("#studyPanel");
const studyIntro = document.querySelector("#studyIntro");
const startSessionButton = document.querySelector("#startSessionButton");
const studyCard = document.querySelector("#studyCard");
const studyActions = document.querySelector("#studyActions");
const studyModeSelect = document.querySelector("#studyModeSelect");
const shuffleCards = document.querySelector("#shuffleCards");
const studyProgress = document.querySelector("#studyProgress");
const cardFrontLabel = document.querySelector("#cardFrontLabel");
const cardBackLabel = document.querySelector("#cardBackLabel");
const cardFrontText = document.querySelector("#cardFrontText");
const cardBackText = document.querySelector("#cardBackText");
const cardBackFace = document.querySelector("#cardBackFace");
const revealCardButton = document.querySelector("#revealCardButton");
const correctCardButton = document.querySelector("#correctCardButton");
const incorrectCardButton = document.querySelector("#incorrectCardButton");
const endSessionButton = document.querySelector("#endSessionButton");
const studyStats = document.querySelector("#studyStats");
const studySummary = document.querySelector("#studySummary");
const troubleLines = document.querySelector("#troubleLines");
const STORAGE_KEY = "memorization-cue-app-state";
const STORAGE_VERSION = 4;
let isConverted = false;
let activeView = "output";
const studyState = {
  cards: [],
  queue: [],
  currentCard: null,
  revealed: false,
  active: false,
  completed: false,
  showSummary: false,
  signature: "",
  sessionCorrect: 0,
  sessionIncorrect: 0,
  stats: new Map()
};

function safeParse(serialized) {
  try {
    return JSON.parse(serialized);
  } catch {
    return null;
  }
}

function readStoredState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? safeParse(raw) : null;
  } catch {
    return null;
  }
}

function serializeStudyState() {
  return {
    cards: studyState.cards,
    queue: studyState.queue,
    currentCard: studyState.currentCard,
    revealed: studyState.revealed,
    active: studyState.active,
    completed: studyState.completed,
    showSummary: studyState.showSummary,
    signature: studyState.signature,
    sessionCorrect: studyState.sessionCorrect,
    sessionIncorrect: studyState.sessionIncorrect,
    stats: Array.from(studyState.stats.entries())
  };
}

function persistState() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        sourceText: sourceText.value,
        markSpecialTokens: markSpecialTokens.checked,
        mode: modeSelect.value,
        character: characterSelect.value,
        isConverted,
        activeView,
        studyMode: studyModeSelect.value,
        shuffleCards: shuffleCards.checked,
        studyState: serializeStudyState()
      })
    );
  } catch {
    // Ignore storage failures and keep the app functional.
  }
}

function restoreStudyState(savedStudyState) {
  if (!savedStudyState) {
    return;
  }

  studyState.cards = Array.isArray(savedStudyState.cards) ? savedStudyState.cards : [];
  studyState.queue = Array.isArray(savedStudyState.queue) ? savedStudyState.queue : [];
  studyState.currentCard = savedStudyState.currentCard ?? null;
  studyState.revealed = Boolean(savedStudyState.revealed);
  studyState.active = Boolean(savedStudyState.active);
  studyState.completed = Boolean(savedStudyState.completed);
  studyState.showSummary = Boolean(savedStudyState.showSummary);
  studyState.signature = typeof savedStudyState.signature === "string" ? savedStudyState.signature : "";
  studyState.sessionCorrect = Number(savedStudyState.sessionCorrect) || 0;
  studyState.sessionIncorrect = Number(savedStudyState.sessionIncorrect) || 0;
  studyState.stats = new Map(Array.isArray(savedStudyState.stats) ? savedStudyState.stats : []);
}

function restoreAppState() {
  const saved = readStoredState();

  if (!saved) {
    return;
  }

  if (saved.version !== STORAGE_VERSION) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures and continue with defaults.
    }
    return;
  }

  sourceText.value = typeof saved.sourceText === "string" ? saved.sourceText : "";
  markSpecialTokens.checked =
    typeof saved.markSpecialTokens === "boolean" ? saved.markSpecialTokens : true;
  modeSelect.value = saved.mode === "script" ? "script" : "memorization";
  studyModeSelect.value = saved.studyMode === "context" ? "context" : "cue";
  shuffleCards.checked =
    typeof saved.shuffleCards === "boolean"
      ? saved.shuffleCards
      : studyModeSelect.value === "context";
  isConverted = Boolean(saved.isConverted);
  activeView = saved.activeView === "study" ? "study" : "output";

  if (modeSelect.value === "script") {
    updateCharacterOptions();

    if (typeof saved.character === "string") {
      characterSelect.value = saved.character;
    }
  }

  restoreStudyState(saved.studyState);
}

function isLetter(character) {
  return /\p{L}/u.test(character);
}

function isUppercaseLetter(character) {
  return /\p{Lu}/u.test(character);
}

function isDigit(character) {
  return /\p{N}/u.test(character);
}

function isApostrophe(character) {
  return /['\u2019\u2018\u02BC\uFF07]/u.test(character);
}

function normalizeApostrophes(text) {
  return text.replace(/[\u2019\u2018\u02BC\uFF07]/gu, "'");
}

function isAllCapsWord(word) {
  const letters = Array.from(word).filter(isLetter);
  return letters.length > 1 && letters.every(isUppercaseLetter);
}

function isNumberToken(word) {
  const characters = Array.from(word);
  return characters.length > 1 && characters.every(isDigit);
}

function isCharacterHeading(line) {
  const trimmed = line.trim();

  if (!trimmed) {
    return false;
  }

  const baseName = trimmed.replace(/\s+\(CONT'D\)$/i, "");
  const letters = Array.from(baseName).filter(isLetter);

  if (letters.length === 0) {
    return false;
  }

  return baseName === baseName.toUpperCase();
}

function extractCharacterName(line) {
  return line.trim().replace(/\s+\(CONT'D\)$/i, "");
}

function cueInlineText(input, options = { markSpecialTokens: false }) {
  let result = "";
  let buffer = "";

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (isLetter(character) || isDigit(character)) {
      buffer += character;
      continue;
    }

    if ((isApostrophe(character) || character === "-") && buffer) {
      buffer += isApostrophe(character) ? "'" : character;
      continue;
    }

    if (buffer) {
      result += transformWord(buffer, options);
      buffer = "";
    }

    result += character;
  }

  if (buffer) {
    result += transformWord(buffer, options);
  }

  return result;
}

function cueDialogueLine(line, options) {
  if (/^\s*\([^)]*\)\s*$/.test(line)) {
    return line;
  }

  return line
    .split(/(\([^)]*\))/g)
    .map((segment) => (/^\([^)]*\)$/.test(segment) ? segment : cueInlineText(segment, options)))
    .join("");
}

function collapseBlockLines(lines) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTextBySentenceBreaks(text) {
  let result = "";

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1] ?? "";

    if (/\s/.test(character)) {
      if (result && !result.endsWith(" ") && !result.endsWith("\n")) {
        result += " ";
      }
      continue;
    }

    result += character;
    let consecutivePeriods = 0;

    if (character === ".") {
      let lookbehind = index - 1;
      let lookahead = index;

      consecutivePeriods = 1;

      while (lookbehind >= 0 && text[lookbehind] === ".") {
        consecutivePeriods += 1;
        lookbehind -= 1;
      }

      while (text[lookahead] === ".") {
        if (lookahead !== index) {
          consecutivePeriods += 1;
        }
        lookahead += 1;
      }
    }

    let nextWordInitial = "";

    if (consecutivePeriods > 1) {
      let lookahead = index + consecutivePeriods;

      while (lookahead < text.length && !isLetter(text[lookahead])) {
        lookahead += 1;
      }

      nextWordInitial = text[lookahead] ?? "";
    }

    const endsSentence =
      character === "!" ||
      character === "?" ||
      (character === "." &&
        nextCharacter !== "." &&
        (consecutivePeriods <= 1 ||
          !nextWordInitial ||
          isUppercaseLetter(nextWordInitial)));

    if (endsSentence) {
      result = result.trimEnd() + "\n";
    }
  }

  return result
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function formatCueParagraph(text, options) {
  const cuedText = text
    .split(/(\([^)]*\))/g)
    .map((segment) => (/^\([^)]*\)$/.test(segment) ? segment : cueInlineText(segment, options)))
    .join("");

  return splitTextBySentenceBreaks(cuedText);
}

function transformWord(word, options) {
  const normalizedWord = normalizeApostrophes(word);
  const firstLetter = Array.from(word).find(isLetter);
  const firstCharacter = Array.from(word)[0];
  const isAcronym = isAllCapsWord(word);
  const isNumber = isNumberToken(word);

  if (options.markSpecialTokens) {
    if (isAcronym && firstLetter) {
      return `${firstLetter}*`;
    }

    if (isNumber && firstCharacter) {
      return `${firstCharacter}*`;
    }
  }

  if (normalizedWord.includes("-")) {
    return normalizedWord
      .split("-")
      .map((part) => transformWord(part, options))
      .filter(Boolean)
      .join("-");
  }

  if (isAcronym || isNumber) {
    return word;
  }

  if (!firstLetter) {
    return "";
  }

  if (normalizedWord.includes("'")) {
    return `${firstLetter}'`;
  }

  return firstLetter;
}

function formatMemorizationCue(input, options = { markSpecialTokens: false }) {
  const normalized = input.replace(/\r?\n+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  return splitTextBySentenceBreaks(cueInlineText(normalized, options)).join("\n");
}

function parseScript(input) {
  const normalized = input.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const blocks = [];
  const characters = [];
  const seenCharacters = new Set();
  let index = 0;

  while (index < lines.length) {
    if (!lines[index].trim()) {
      index += 1;
      continue;
    }

    const blockLines = [];

    while (index < lines.length && lines[index].trim()) {
      blockLines.push(lines[index]);
      index += 1;
    }

    const firstLine = blockLines[0] ?? "";

    if (isCharacterHeading(firstLine) && blockLines.length > 1) {
      const speaker = extractCharacterName(firstLine);

      blocks.push({
        type: "dialogue",
        speaker,
        heading: firstLine,
        lines: blockLines.slice(1)
      });

      if (!seenCharacters.has(speaker)) {
        seenCharacters.add(speaker);
        characters.push(speaker);
      }

      continue;
    }

    blocks.push({
      type: "action",
      lines: blockLines
    });
  }

  return { blocks, characters };
}

function formatScriptCue(input, selectedCharacter, options) {
  const { blocks } = parseScript(input);

  if (!blocks.length) {
    return "";
  }

  return blocks
    .map((block) => {
      if (block.type === "action") {
        return collapseBlockLines(block.lines);
      }

      const shouldCue = selectedCharacter && block.speaker === selectedCharacter;
      const dialogueText = collapseBlockLines(block.lines);
      const formattedDialogue = shouldCue
        ? formatCueParagraph(dialogueText, options)
        : dialogueText;

      return [block.heading, formattedDialogue].join("\n");
    })
    .join("\n\n")
    .trim();
}

function buildMemorizationOutput(input, options) {
  const normalized = input.replace(/\r?\n+/g, " ").trim();

  if (!normalized) {
    return [];
  }

  const originalLines = splitTextBySentenceBreaks(normalized);
  const displayLines = splitTextBySentenceBreaks(cueInlineText(normalized, options));

  return [
    {
      lines: displayLines.map((display, index) => ({
        display,
        original: originalLines[index] ?? originalLines[originalLines.length - 1] ?? display
      }))
    }
  ];
}

function buildScriptOutput(input, selectedCharacter, options) {
  const { blocks } = parseScript(input);

  return blocks.map((block) => {
    if (block.type === "action") {
      const paragraph = collapseBlockLines(block.lines);
      return {
        lines: paragraph ? [{ display: paragraph, original: paragraph }] : []
      };
    }

    const dialogueText = collapseBlockLines(block.lines);
    const headingLine = {
      display: block.heading,
      original: block.heading
    };

    if (!selectedCharacter || block.speaker !== selectedCharacter) {
      return {
        lines: [headingLine, { display: dialogueText, original: dialogueText }].filter(
          (line) => line.display
        )
      };
    }

    const originalLines = splitTextBySentenceBreaks(dialogueText);
    const displayLines = formatCueParagraph(dialogueText, options);

    return {
      lines: [
        headingLine,
        ...displayLines.map((display, index) => ({
          display,
          original: originalLines[index] ?? originalLines[originalLines.length - 1] ?? display
        }))
      ]
    };
  });
}

function buildStudyUnits(input, selectedCharacter) {
  const { blocks } = parseScript(input);

  return blocks.flatMap((block) => {
    if (block.type === "action") {
      const paragraph = collapseBlockLines(block.lines);
      return paragraph
        ? [{ type: "action", speaker: null, text: paragraph }]
        : [];
    }

    const dialogueText = collapseBlockLines(block.lines);
    if (block.speaker !== selectedCharacter) {
      return dialogueText
        ? [
            {
              type: "dialogue_block",
              speaker: block.speaker,
              heading: block.heading,
              text: dialogueText
            }
          ]
        : [];
    }

    const sentences = splitTextBySentenceBreaks(dialogueText);

    return sentences.map((sentence, index) => ({
      type: "dialogue_sentence",
      speaker: block.speaker,
      heading: index === 0 ? block.heading : block.speaker,
      text: sentence
    }));
  });
}

function cueSentence(text, options) {
  return formatCueParagraph(text, options).join("\n");
}

function formatPromptUnit(unit) {
  if (!unit) {
    return "";
  }

  if (unit.type === "dialogue_sentence" || unit.type === "dialogue_block") {
    return `${unit.speaker}\n${unit.text}`;
  }

  return unit.text;
}

function buildContextPrompt(units, currentIndex, depth = 1) {
  const start = Math.max(0, currentIndex - depth);
  return units
    .slice(start, currentIndex)
    .map((unit) => formatPromptUnit(unit))
    .join("\n\n");
}

function buildContextContent(units, currentIndex, depth = 1) {
  const start = Math.max(0, currentIndex - depth);
  return units
    .slice(start, currentIndex)
    .map((unit) => unit.text)
    .join(" ");
}

function countWords(text) {
  const normalizedText = normalizeApostrophes(text);
  const matches = normalizedText.match(/\b[\p{L}\p{N}']+\b/gu);
  return matches ? matches.length : 0;
}

function shuffleList(items) {
  const clone = [...items];

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }

  return clone;
}

function buildStudyDeck(input, selectedCharacter, options) {
  if (!selectedCharacter) {
    return [];
  }

  const units = buildStudyUnits(input, selectedCharacter);
  const deck = [];
  let cardIndex = 0;

  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];

    if (unit.type !== "dialogue_sentence" || unit.speaker !== selectedCharacter) {
      continue;
    }

    if (studyModeSelect.value === "cue") {
      deck.push({
        id: `${selectedCharacter}-cue-${cardIndex}`,
        unitIndex: index,
        frontLabel: "Cue",
        frontText: cueSentence(unit.text, options),
        revealText: unit.text,
        backLabel: "Original Line",
        backText: unit.text,
        backTooltip: unit.text
      });
      cardIndex += 1;
      continue;
    }

    const previousUnit = units[index - 1];
    const isOpeningLine = !previousUnit;

    deck.push({
      id: `${selectedCharacter}-context-${cardIndex}`,
      unitIndex: index,
      frontLabel: isOpeningLine ? "Opening Line" : "Context",
      frontText: isOpeningLine ? `${selectedCharacter}\nScene start` : buildContextPrompt(units, index),
      revealText: cueSentence(unit.text, options),
      backLabel: "Cue",
      backText: cueSentence(unit.text, options),
      backTooltip: unit.text
    });

    if (!isOpeningLine && countWords(buildContextContent(units, index)) <= 1 && index > 1) {
      deck[deck.length - 1].frontText = buildContextPrompt(units, index, 2);
    }

    cardIndex += 1;
  }

  if (studyModeSelect.value === "context") {
    const promptCounts = new Map();

    for (const card of deck) {
      promptCounts.set(card.frontText, (promptCounts.get(card.frontText) ?? 0) + 1);
    }

    for (let index = 0; index < deck.length; index += 1) {
      const card = deck[index];

      if ((promptCounts.get(card.frontText) ?? 0) <= 1) {
        continue;
      }

      if (card.unitIndex > 1) {
        card.frontText = buildContextPrompt(units, card.unitIndex, 2);
      }
    }
  }

  return shuffleCards.checked ? shuffleList(deck) : deck;
}

function getStudySignature() {
  return JSON.stringify({
    source: sourceText.value,
    character: characterSelect.value,
    studyMode: studyModeSelect.value,
    markSpecialTokens: markSpecialTokens.checked,
    shuffle: shuffleCards.checked
  });
}

function buildOutputModel() {
  const options = {
    markSpecialTokens: markSpecialTokens.checked
  };

  if (modeSelect.value === "script") {
    return buildScriptOutput(sourceText.value, characterSelect.value, options);
  }

  return buildMemorizationOutput(sourceText.value, options);
}

function renderFormattedOutput(blocks) {
  formattedText.innerHTML = "";

  const hasLines = blocks.some((block) => block.lines.length > 0);

  if (!hasLines) {
    const placeholder = document.createElement("p");
    placeholder.className = "output-placeholder";
    placeholder.textContent = "Converted text will appear here.";
    formattedText.appendChild(placeholder);
    return;
  }

  for (const block of blocks) {
    if (!block.lines.length) {
      continue;
    }

    const blockElement = document.createElement("div");
    blockElement.className = "output-block";

    for (const line of block.lines) {
      const lineElement = document.createElement("div");
      lineElement.className = "output-line";
      lineElement.textContent = line.display;
      lineElement.title = line.original;
      blockElement.appendChild(lineElement);
    }

    formattedText.appendChild(blockElement);
  }
}

function ensureCardStats(cards) {
  for (const card of cards) {
    if (!studyState.stats.has(card.id)) {
      studyState.stats.set(card.id, {
        text: card.backTooltip ?? card.backText,
        correct: 0,
        incorrect: 0
      });
    }
  }
}

function renderStudyStats() {
  studyStats.classList.toggle("is-hidden", !studyState.showSummary);

  if (!studyState.showSummary) {
    return;
  }

  const remaining = studyState.queue.length + (studyState.currentCard ? 1 : 0);
  const statsList = Array.from(studyState.stats.values());
  const attempted = statsList.filter((entry) => entry.correct > 0 || entry.incorrect > 0).length;
  const summaryPrefix = studyState.completed ? "Session complete." : "Session ended.";
  studySummary.textContent =
    `${summaryPrefix} Correct: ${studyState.sessionCorrect}. ` +
    `Incorrect: ${studyState.sessionIncorrect}. Attempted cards: ${attempted}. Remaining: ${remaining}.`;

  const hardest = Array.from(studyState.stats.entries())
    .map(([id, entry]) => ({ id, ...entry }))
    .filter((entry) => entry.incorrect > 0)
    .sort((left, right) => {
      if (right.incorrect !== left.incorrect) {
        return right.incorrect - left.incorrect;
      }

      return left.text.localeCompare(right.text);
    })
    .slice(0, 5);

  troubleLines.innerHTML = "";

  if (!hardest.length) {
    troubleLines.textContent = studyState.completed
      ? "No missed lines this session."
      : "No missed lines yet.";
    return;
  }

  for (const entry of hardest) {
    const item = document.createElement("div");
    item.className = "trouble-item";

    const count = document.createElement("span");
    count.className = "trouble-count";
    count.textContent = `${entry.incorrect} miss${entry.incorrect === 1 ? "" : "es"}`;

    const text = document.createElement("div");
    text.textContent = entry.text;

    item.appendChild(count);
    item.appendChild(text);
    troubleLines.appendChild(item);
  }
}

function resetStudySession({ keepSummary = false } = {}) {
  studyState.cards = [];
  studyState.queue = [];
  studyState.currentCard = null;
  studyState.revealed = false;
  studyState.active = false;
  studyState.completed = false;
  studyState.sessionCorrect = 0;
  studyState.sessionIncorrect = 0;
  studyState.stats = new Map();
  studyState.showSummary = keepSummary && studyState.showSummary;
}

function startStudySession() {
  const options = {
    markSpecialTokens: markSpecialTokens.checked
  };

  studyState.cards = buildStudyDeck(sourceText.value, characterSelect.value, options);
  studyState.queue = [...studyState.cards];
  studyState.currentCard = studyState.queue.shift() ?? null;
  studyState.revealed = false;
  studyState.active = studyState.cards.length > 0;
  studyState.completed = false;
  studyState.showSummary = false;
  studyState.sessionCorrect = 0;
  studyState.sessionIncorrect = 0;
  studyState.stats = new Map();
  studyState.signature = getStudySignature();
  ensureCardStats(studyState.cards);
}

function renderStudyDeck() {
  const canStudy = isConverted && modeSelect.value === "script";
  studyPanel.classList.toggle("is-hidden", !canStudy);

  if (!canStudy) {
    resetStudySession();
    return;
  }

  const nextSignature = getStudySignature();

  if (studyState.signature !== nextSignature) {
    resetStudySession();
    studyState.signature = nextSignature;
  }

  renderStudyCard();
  renderStudyStats();
}

function renderStudyCard() {
  const sessionRunning = studyState.active && Boolean(studyState.currentCard);
  const hasCardsAvailable = buildStudyDeck(sourceText.value, characterSelect.value, {
    markSpecialTokens: markSpecialTokens.checked
  }).length > 0;

  studyIntro.classList.toggle("is-hidden", studyState.active);
  studyCard.classList.toggle("is-hidden", !studyState.active);
  studyActions.classList.toggle("is-hidden", !studyState.active);
  cardBackFace.classList.toggle("is-hidden", !studyState.revealed || !sessionRunning);
  startSessionButton.disabled = !hasCardsAvailable;
  revealCardButton.classList.toggle("is-hidden", !studyState.active || studyState.revealed);
  correctCardButton.classList.toggle("is-hidden", !studyState.active || !studyState.revealed);
  incorrectCardButton.classList.toggle("is-hidden", !studyState.active || !studyState.revealed);
  endSessionButton.classList.toggle("is-hidden", !studyState.active);
  revealCardButton.disabled = !sessionRunning;
  correctCardButton.disabled = !sessionRunning || !studyState.revealed;
  incorrectCardButton.disabled = !sessionRunning || !studyState.revealed;
  endSessionButton.disabled = !studyState.active;

  if (!studyState.active) {
    studyProgress.textContent = hasCardsAvailable
      ? "Session not started."
      : "No cards available for the selected character.";
    cardFrontLabel.textContent = "Prompt";
    cardBackLabel.textContent = "Answer";
    cardFrontText.textContent = hasCardsAvailable
      ? "Start a session to begin studying."
      : "Select a character and convert a script to build flashcards.";
    cardBackText.textContent = "";
    revealCardButton.textContent = studyModeSelect.value === "context" ? "Reveal Cue" : "Reveal Answer";
    persistState();
    return;
  }

  const card = studyState.currentCard;
  const remaining = studyState.queue.length + 1;
  studyProgress.textContent = `${remaining} card${remaining === 1 ? "" : "s"} remaining in session`;
  cardFrontLabel.textContent = card.frontLabel;
  cardBackLabel.textContent = card.backLabel;
  cardFrontText.textContent = card.frontText;
  cardBackText.textContent = card.revealText;
  cardBackText.title = card.backTooltip ?? card.backText;
  revealCardButton.textContent =
    studyModeSelect.value === "context" ? "Reveal Cue" : "Reveal Answer";
  correctCardButton.textContent = "I Knew It";
  persistState();
}

function advanceSession(card, outcome) {
  const entry = studyState.stats.get(card.id);

  if (entry) {
    if (outcome === "correct") {
      entry.correct += 1;
      studyState.sessionCorrect += 1;
    } else {
      entry.incorrect += 1;
      studyState.sessionIncorrect += 1;
    }
  }

  if (outcome === "incorrect") {
    studyState.queue.push(card);
  }

  studyState.currentCard = studyState.queue.shift() ?? null;
  studyState.revealed = false;
  studyState.active = Boolean(studyState.currentCard);
  studyState.completed = !studyState.currentCard && studyState.cards.length > 0;
  studyState.showSummary = studyState.completed;
  renderStudyCard();
  renderStudyStats();
}

function markCard(outcome) {
  if (!studyState.currentCard || !studyState.revealed) {
    return;
  }

  const currentCard = studyState.currentCard;
  advanceSession(currentCard, outcome);
}

function revealCard() {
  if (!studyState.currentCard) {
    return;
  }

  studyState.revealed = true;
  renderStudyCard();
}

function endSession() {
  studyState.active = false;
  studyState.completed = false;
  studyState.queue = [];
  studyState.currentCard = null;
  studyState.revealed = false;
  studyState.showSummary = true;
  renderStudyCard();
  renderStudyStats();
}

function updateCharacterOptions() {
  const { characters } = parseScript(sourceText.value);
  const previousValue = characterSelect.value;

  characterSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = characters.length ? "Choose a character" : "No characters detected";
  characterSelect.appendChild(placeholder);

  for (const character of characters) {
    const option = document.createElement("option");
    option.value = character;
    option.textContent = character;
    characterSelect.appendChild(option);
  }

  characterSelect.disabled = modeSelect.value !== "script" || characters.length === 0;

  if (characters.includes(previousValue)) {
    characterSelect.value = previousValue;
  } else {
    characterSelect.value = "";
  }
}

function updateControlState() {
  const isScriptMode = modeSelect.value === "script";
  characterField.classList.toggle("is-hidden", !isScriptMode);
  characterSelect.disabled = !isScriptMode || characterSelect.options.length <= 1;
  sourceField.classList.toggle("is-hidden", isConverted);
  convertButton.classList.toggle("is-hidden", isConverted);
  editButton.classList.toggle("is-hidden", !isConverted);
  viewTabs.classList.toggle("is-hidden", !isConverted || !isScriptMode);
  outputField.classList.toggle("is-hidden", !isConverted || (isScriptMode && activeView !== "output"));
  studyPanel.classList.toggle("is-hidden", !isConverted || !isScriptMode || activeView !== "study");
  outputTabButton.classList.toggle("is-active", activeView === "output");
  studyTabButton.classList.toggle("is-active", activeView === "study");
}

function renderOutput() {
  if (modeSelect.value === "script") {
    updateCharacterOptions();
  }
  updateControlState();

  if (!isConverted) {
    renderFormattedOutput([]);
    renderStudyDeck();
    persistState();
    return;
  }

  renderFormattedOutput(buildOutputModel());
  renderStudyDeck();
  persistState();
}

function convertText() {
  isConverted = true;
  activeView = "output";
  renderOutput();
}

function editSource() {
  isConverted = false;
  endSession();
  renderOutput();
}

sourceText.addEventListener("input", () => {
  if (modeSelect.value === "script") {
    updateCharacterOptions();
    updateControlState();
  }
});
markSpecialTokens.addEventListener("change", renderOutput);
modeSelect.addEventListener("change", renderOutput);
characterSelect.addEventListener("change", renderOutput);
studyModeSelect.addEventListener("change", () => {
  if (studyModeSelect.value === "context") {
    shuffleCards.checked = true;
  }
  renderOutput();
});
shuffleCards.addEventListener("change", renderOutput);
convertButton.addEventListener("click", convertText);
editButton.addEventListener("click", editSource);
outputTabButton.addEventListener("click", () => {
  activeView = "output";
  renderOutput();
});
studyTabButton.addEventListener("click", () => {
  activeView = "study";
  renderOutput();
});
startSessionButton.addEventListener("click", () => {
  startStudySession();
  renderStudyCard();
  renderStudyStats();
});
revealCardButton.addEventListener("click", revealCard);
correctCardButton.addEventListener("click", () => markCard("correct"));
incorrectCardButton.addEventListener("click", () => markCard("incorrect"));
endSessionButton.addEventListener("click", endSession);
restoreAppState();
renderOutput();
