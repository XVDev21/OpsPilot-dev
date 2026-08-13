"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

export type AppMode = "live" | "demo";

interface AppModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const storageKey = "opspilot:mode:v1";
const modeChangeEvent = "opspilot:mode-change";
const AppModeContext = createContext<AppModeContextValue | null>(null);

function getModeStorage() {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function readMode(): AppMode {
  const saved = getModeStorage()?.getItem(storageKey);
  return saved === "demo" ? "demo" : "live";
}

function subscribeToMode(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(modeChangeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(modeChangeEvent, onStoreChange);
  };
}

export function AppModeProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore<AppMode>(subscribeToMode, readMode, () => "live");

  const value = useMemo<AppModeContextValue>(
    () => ({
      mode,
      setMode(nextMode) {
        getModeStorage()?.setItem(storageKey, nextMode);
        window.dispatchEvent(new Event(modeChangeEvent));
      },
    }),
    [mode],
  );

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode() {
  const value = useContext(AppModeContext);
  if (!value) throw new Error("useAppMode must be used inside AppModeProvider");
  return value;
}
