/**
 * Browser storage. Every access is wrapped: storage can be blocked (private
 * windows, cleared site data) and the app must still work without it.
 * Nothing here holds chat content (M11, data minimisation).
 */

function read<T>(store: () => Storage, key: string, fallback: T): T {
  try {
    const raw = store().getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(store: () => Storage, key: string, value: unknown): void {
  try {
    store().setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep going in memory */
  }
}

function remove(store: () => Storage, key: string): void {
  try {
    store().removeItem(key);
  } catch {
    /* ignore */
  }
}

const local = () => window.localStorage;
const session = () => window.sessionStorage;

const K = {
  apiKey: "s4250.apiKey",
  model: "s4250.model",
  gate: "s4250.gate",
  moodOptIn: "s4250.moodOptIn",
  mood: "s4250.mood",
  usage: "s4250.usage",
};

// ---- credentials (session only unless the user ticks "remember") ----
export function loadApiKey(): string {
  return read(session, K.apiKey, "") || read(local, K.apiKey, "");
}
export function saveApiKey(key: string, remember: boolean): void {
  write(session, K.apiKey, key);
  if (remember) write(local, K.apiKey, key);
  else remove(local, K.apiKey);
}
export function forgetApiKey(): void {
  remove(session, K.apiKey);
  remove(local, K.apiKey);
}
// ---- proxy sign-in (this tab only) ----
const PROXY_AUTH = "s4250.proxyAuth";
export const loadProxyAuth = (): string => read(session, PROXY_AUTH, "");
export const saveProxyAuth = (basic: string) => write(session, PROXY_AUTH, basic);
export const forgetProxyAuth = () => remove(session, PROXY_AUTH);

export const loadModel = (fallback: string) => read(local, K.model, fallback);
export const saveModel = (m: string) => write(local, K.model, m);
export const gatePassed = () => read(session, K.gate, false);
export const markGatePassed = () => write(session, K.gate, true);

// ---- mood log (M7, opt-in, visible, deletable) ----
export interface MoodEntry {
  at: number;
  score: 1 | 2 | 3 | 4 | 5;
}
export const moodOptedIn = () => read(local, K.moodOptIn, false);
export const setMoodOptIn = (v: boolean) => write(local, K.moodOptIn, v);
export const loadMood = (): MoodEntry[] => read(local, K.mood, []);
export const saveMood = (m: MoodEntry[]) => write(local, K.mood, m);

// ---- usage log (M8): timestamps only, never content ----
export interface UsageLog {
  messages: number[]; // student message timestamps
  sessions: number[]; // session start timestamps
}
export const loadUsage = (): UsageLog => read(local, K.usage, { messages: [], sessions: [] });
export const saveUsage = (u: UsageLog) => write(local, K.usage, u);

export function deleteMyData(): void {
  for (const k of [K.mood, K.moodOptIn, K.usage]) remove(local, k);
}
