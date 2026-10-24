export interface AgentProgressEvent {
  text: string;
}

export interface AgentRunOptions {
  url: string;
  goal: string;
  // TinyFish profiles are "lite" (default) and "stealth"
  browserProfile?: "lite" | "stealth";
  proxyCountry?: string;
  signal?: AbortSignal;
  onEvent?: (event: AgentProgressEvent) => void;
}

export interface AgentRunResult {
  runId?: string;
  resultJson: unknown;
}

export interface SearchHit {
  position: number;
  title: string;
  url: string;
  snippet: string;
  siteName: string;
}

export interface FetchedPage {
  url: string;
  finalUrl: string;
  title: string | null;
  text: string;
}
