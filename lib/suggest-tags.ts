/**
 * Lightweight keyword / phrase suggestions for paste-transcript tagging.
 * Strips speaker labels and stop words; ranks unigrams and bigrams by frequency.
 */

const SPEAKER_LABEL_RE =
  /(?:^|\n)\s*(?:User|You|Human|DeepSeek|ChatGPT|GPT|Claude|Gemini|Assistant|AI|Thought\s+process|Thinking|Thought\s+for\b[^\n:]*)\s*:\s*/gim;

const CODE_FENCE_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`]+`/g;
/** Markdown images: ![alt](url) and linked images [![alt](src)](href). */
const MD_IMAGE_RE = /!?\[(?:[^\]]*)\]\([^)]*\)/g;
/** Standard markdown links [label](url). */
const MD_LINK_RE = /\[[^\]]*\]\([^)]*\)/g;
const DATA_URI_RE = /data:[a-z0-9.+/-]+;base64,[a-z0-9+/=]+/gi;
const URL_RE = /https?:\/\/\S+/gi;
const WWW_URL_RE = /\bwww\.\S+/gi;
/** Keep letters / apostrophes / hyphens only — drop digits that create hash-like tokens.
 * Uppercase must be allowed here; lowercase is applied after this strip. */
const NON_WORD_RE = /[^a-zA-Z\s'-]+/g;

const STOP_WORDS = new Set([
  "a",
  "about",
  "above",
  "after",
  "again",
  "against",
  "all",
  "am",
  "an",
  "and",
  "any",
  "are",
  "aren't",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "can",
  "can't",
  "cannot",
  "could",
  "couldn't",
  "did",
  "didn't",
  "do",
  "does",
  "doesn't",
  "doing",
  "don't",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "get",
  "got",
  "had",
  "hadn't",
  "has",
  "hasn't",
  "have",
  "haven't",
  "having",
  "he",
  "he'd",
  "he'll",
  "he's",
  "her",
  "here",
  "here's",
  "hers",
  "herself",
  "him",
  "himself",
  "his",
  "how",
  "how's",
  "i",
  "i'd",
  "i'll",
  "i'm",
  "i've",
  "if",
  "in",
  "into",
  "is",
  "isn't",
  "it",
  "it's",
  "its",
  "itself",
  "just",
  "let's",
  "like",
  "ll",
  "me",
  "more",
  "most",
  "mustn't",
  "my",
  "myself",
  "no",
  "nor",
  "not",
  "of",
  "off",
  "on",
  "once",
  "only",
  "or",
  "other",
  "ought",
  "our",
  "ours",
  "ourselves",
  "out",
  "over",
  "own",
  "please",
  "re",
  "same",
  "shan't",
  "she",
  "she'd",
  "she'll",
  "she's",
  "should",
  "shouldn't",
  "so",
  "some",
  "such",
  "than",
  "that",
  "that's",
  "the",
  "their",
  "theirs",
  "them",
  "themselves",
  "then",
  "there",
  "there's",
  "these",
  "they",
  "they'd",
  "they'll",
  "they're",
  "they've",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "ve",
  "was",
  "wasn't",
  "we",
  "we'd",
  "we'll",
  "we're",
  "we've",
  "were",
  "weren't",
  "what",
  "what's",
  "when",
  "when's",
  "where",
  "where's",
  "which",
  "while",
  "who",
  "who's",
  "whom",
  "why",
  "why's",
  "will",
  "with",
  "won't",
  "would",
  "wouldn't",
  "you",
  "you'd",
  "you'll",
  "you're",
  "you've",
  "your",
  "yours",
  "yourself",
  "yourselves",
  // Chat / AI noise
  "ai",
  "assistant",
  "chatgpt",
  "claude",
  "code",
  "deepseek",
  "example",
  "gemini",
  "help",
  "here",
  "let",
  "make",
  "need",
  "okay",
  "please",
  "question",
  "response",
  "sure",
  "thank",
  "thanks",
  "think",
  "use",
  "using",
  "user",
  "want",
  "way",
]);

function isContentToken(token: string): boolean {
  if (token.length < 3 || token.length > 20) return false;
  if (STOP_WORDS.has(token)) return false;
  // Strictly alphabetical words (optional internal apostrophe/hyphen only).
  if (!/^[a-z]+(?:['-][a-z]+)*$/i.test(token)) return false;
  return true;
}

function preprocessTranscript(raw: string): string {
  return raw
    .replace(CODE_FENCE_RE, " ")
    .replace(INLINE_CODE_RE, " ")
    .replace(MD_IMAGE_RE, " ")
    .replace(MD_LINK_RE, " ")
    .replace(DATA_URI_RE, " ")
    .replace(URL_RE, " ")
    .replace(WWW_URL_RE, " ")
    .replace(SPEAKER_LABEL_RE, "\n")
    .replace(NON_WORD_RE, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns up to `limit` suggested tags (unigrams and bigrams), ranked by frequency.
 */
export function extractSuggestedTags(raw: string, limit = 5): string[] {
  const cleaned = preprocessTranscript(raw);
  if (cleaned.length < 12) return [];

  const tokens = cleaned
    .split(" ")
    .map((t) => t.replace(/^['-]+|['-]+$/g, ""))
    .filter(isContentToken);

  if (tokens.length === 0) return [];

  const scores = new Map<string, number>();

  for (const token of tokens) {
    scores.set(token, (scores.get(token) ?? 0) + 1);
  }

  for (let i = 0; i < tokens.length - 1; i++) {
    const left = tokens[i];
    const right = tokens[i + 1];
    if (!left || !right) continue;
    // Prefer content-y bigrams; skip hyphenated noise that is essentially one word.
    const phrase = `${left} ${right}`;
    if (phrase.length > 40) continue;
    // Bigrams score higher per occurrence so multi-word phrases can surface.
    scores.set(phrase, (scores.get(phrase) ?? 0) + 2.2);
  }

  const ranked = Array.from(scores.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      // Prefer multi-word phrases on ties, then longer terms, then alpha.
      const aSpace = a[0].includes(" ") ? 1 : 0;
      const bSpace = b[0].includes(" ") ? 1 : 0;
      if (bSpace !== aSpace) return bSpace - aSpace;
      if (b[0].length !== a[0].length) return b[0].length - a[0].length;
      return a[0].localeCompare(b[0]);
    })
    .map(([term]) => term);

  const picked: string[] = [];
  const coveredUnigrams = new Set<string>();

  for (const term of ranked) {
    if (picked.length >= limit) break;

    const parts = term.split(" ");
    // Skip unigram already covered by a selected phrase.
    if (parts.length === 1 && coveredUnigrams.has(term)) continue;
    // Skip phrase whose both words are already covered weakly — still allow once.
    if (
      parts.length > 1 &&
      parts.every((part: string) => coveredUnigrams.has(part)) &&
      picked.some((existing) => existing.includes(parts[0]!))
    ) {
      continue;
    }

    picked.push(term);
    for (const part of parts) coveredUnigrams.add(part);
  }

  return picked;
}

/** Alias used by Paste transcript “Suggest Tags” UI. */
export function suggestTags(transcriptText: string, limit = 5): string[] {
  return extractSuggestedTags(transcriptText, limit);
}
