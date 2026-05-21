"use client";

export type HeaderStyle = "card" | "gradient" | "plain";
export type HeaderPattern = "grid" | "dots" | "blobs" | "stripes" | "none";
export type Density = "compact" | "comfy" | "spacious";

export interface Tweaks {
  headerStyle: HeaderStyle;
  headerPattern: HeaderPattern;
  density: Density;
}

const DEFAULTS: Tweaks = {
  headerStyle: "gradient",
  headerPattern: "dots",
  density: "comfy",
};

const STORAGE_KEY = "wh-tweaks";

let state: Tweaks = DEFAULTS;
let hydrated = false;
const listeners = new Set<() => void>();

function loadFromStorage(): Tweaks {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed } as Tweaks;
  } catch {
    return DEFAULTS;
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function applyDensity() {
  if (typeof document === "undefined") return;
  const pad =
    state.density === "compact"
      ? "20px 26px"
      : state.density === "spacious"
        ? "36px 40px"
        : "28px 32px";
  document.documentElement.style.setProperty("--wh-density-pad", pad);
}

export function getTweaks(): Tweaks {
  if (!hydrated && typeof window !== "undefined") {
    state = loadFromStorage();
    hydrated = true;
    applyDensity();
  }
  return state;
}

export function setTweak<K extends keyof Tweaks>(key: K, value: Tweaks[K]) {
  state = { ...state, [key]: value };
  persist();
  applyDensity();
  listeners.forEach((l) => l());
}

export function subscribeTweaks(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
