"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

export type AppMode = "live" | "demo";
export type AIProvider = "gemini" | "openai" | "qwen";
export type IntelligenceLevel = "fast" | "balanced" | "high";

interface AppModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  provider: AIProvider;
  setProvider: (provider: AIProvider) => void;
  intelligence: IntelligenceLevel;
  setIntelligence: (intelligence: IntelligenceLevel) => void;
}

const modeStorageKey = "opspilot:mode:v1";
const providerStorageKey = "opspilot:provider:v2";
const intelligenceStorageKey = "opspilot:intelligence:v1";
const preferenceChangeEvent = "opspilot:preferences-change";
const AppModeContext = createContext<AppModeContextValue | null>(null);

function getModeStorage() {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function readMode(): AppMode {
  const saved = getModeStorage()?.getItem(modeStorageKey);
  return saved === "demo" ? "demo" : "live";
}

function readProvider(): AIProvider {
  const saved = getModeStorage()?.getItem(providerStorageKey);
  return saved === "openai" || saved === "qwen" ? saved : "gemini";
}

function readIntelligence(): IntelligenceLevel {
  const saved = getModeStorage()?.getItem(intelligenceStorageKey);
  return saved === "balanced" || saved === "high" ? saved : "fast";
}

function subscribeToPreferences(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(preferenceChangeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(preferenceChangeEvent, onStoreChange);
  };
}

function persistPreference(key: string, value: string) {
  getModeStorage()?.setItem(key, value);
  window.dispatchEvent(new Event(preferenceChangeEvent));
}

function readPreferences() {
  return `${readMode()}:${readProvider()}:${readIntelligence()}`;
}

export function AppModeProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore<string>(
    subscribeToPreferences,
    readPreferences,
    () => "live:gemini:fast",
  );
  const [mode, provider, intelligence] = snapshot.split(":") as [
    AppMode,
    AIProvider,
    IntelligenceLevel,
  ];

  const value = useMemo<AppModeContextValue>(
    () => ({
      mode,
      provider,
      intelligence,
      setMode(nextMode) {
        persistPreference(modeStorageKey, nextMode);
      },
      setProvider(nextProvider) {
        persistPreference(providerStorageKey, nextProvider);
      },
      setIntelligence(nextIntelligence) {
        persistPreference(intelligenceStorageKey, nextIntelligence);
      },
    }),
    [intelligence, mode, provider],
  );

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode() {
  const value = useContext(AppModeContext);
  if (!value) throw new Error("useAppMode must be used inside AppModeProvider");
  return value;
}
