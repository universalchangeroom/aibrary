export type ImportSource = "ChatGPT" | "Claude" | "Perplexity" | "DeepSeek";

export interface ImportedMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ImportedThread {
  source: ImportSource;
  originalUrl: string;
  title: string;
  messages: ImportedMessage[];
}

export type SupportedPlatform = {
  source: ImportSource;
  hostPattern: RegExp;
  pathPattern: RegExp;
};
