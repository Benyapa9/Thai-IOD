"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type MessageKey, translate } from "@/lib/i18n";
import type { FeatureKey, TierId } from "@/lib/access/catalog";
import type { Locale, Theme } from "@/types/domain";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  /** Access tier (Basic / Standard / Advanced / IT). */
  tier: TierId;
  /** Effective features from the live Tier × Feature matrix. */
  features: FeatureKey[];
  image: string | null;
  jobTitle: string | null;
  /** Departments the user may see; null = all (MOM A5). */
  departments: string[] | null;
  consentDecided: boolean;
  /** Product tours already seen (tour id → version). */
  tourSeen: Record<string, number>;
}

export type Mode = "light" | "dark";

interface Prefs {
  theme: Theme;
  locale: Locale;
  /** Day / night look (this browser only). */
  mode: Mode;
  /** Base colour of the "custom" theme (this browser only). */
  customColor: string;
  setTheme: (t: Theme) => void;
  setLocale: (l: Locale) => void;
  setMode: (m: Mode) => void;
  /** Pick a custom colour and switch to the custom theme. */
  setCustomColor: (hex: string) => void;
}

const UserContext = createContext<CurrentUser | null>(null);
const PrefsContext = createContext<Prefs | null>(null);

export const THEME_STORAGE_KEY = "iod-theme";
export const THEME_COLOR_STORAGE_KEY = "iod-theme-color";
export const MODE_STORAGE_KEY = "iod-mode";
export const DEFAULT_CUSTOM_COLOR = "#2563eb";

function readStore(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode) — the choice still applies for this session
  }
}

export function UserProvider({
  user,
  theme: initialTheme,
  locale: initialLocale,
  children,
}: {
  user: CurrentUser;
  theme: Theme;
  locale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  // Start from the defaults on the server render; the pre-paint script in the root layout has already applied the stored values.
  const [mode, setModeState] = useState<Mode>("light");
  const [customColor, setCustomColorState] = useState(DEFAULT_CUSTOM_COLOR);
  // Do not write the defaults over the saved values before they have been read.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync once from this browser's saved choice */
    if (readStore(MODE_STORAGE_KEY) === "dark") setModeState("dark");
    const c = readStore(THEME_COLOR_STORAGE_KEY);
    if (c && /^#[0-9a-f]{6}$/i.test(c)) setCustomColorState(c);
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeStore(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!loaded) return;
    document.documentElement.dataset.mode = mode;
    writeStore(MODE_STORAGE_KEY, mode);
  }, [mode, loaded]);

  useEffect(() => {
    if (!loaded) return;
    document.documentElement.style.setProperty("--theme-base", customColor);
    writeStore(THEME_COLOR_STORAGE_KEY, customColor);
  }, [customColor, loaded]);

  const save = useCallback((patch: Partial<{ theme: Theme; locale: Locale }>) => {
    void fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  }, []);

  const prefs = useMemo<Prefs>(
    () => ({
      theme,
      locale,
      mode,
      customColor,
      setMode: setModeState,
      setCustomColor: (hex) => {
        setCustomColorState(hex);
        setThemeState("custom");
        // The picker fires on every drag step; only the switch to "custom" is saved to the profile.
        if (theme !== "custom") save({ theme: "custom" });
      },
      setTheme: (t) => {
        setThemeState(t);
        save({ theme: t });
      },
      setLocale: (l) => {
        setLocaleState(l);
        document.cookie = `locale=${l}; path=/; max-age=31536000; samesite=lax`;
        document.documentElement.lang = l;
        save({ locale: l });
        router.refresh();
      },
    }),
    [theme, locale, mode, customColor, save, router],
  );

  return (
    <UserContext.Provider value={user}>
      <PrefsContext.Provider value={prefs}>{children}</PrefsContext.Provider>
    </UserContext.Provider>
  );
}

export function useCurrentUser() {
  const user = useContext(UserContext);
  if (!user) throw new Error("useCurrentUser must be used inside UserProvider");
  return user;
}

/** UI only (show/hide). Every API route re-checks on the server with requireFeature(). */
export function useCan(feature: FeatureKey) {
  return useCurrentUser().features.includes(feature);
}

export function usePrefs() {
  const prefs = useContext(PrefsContext);
  if (!prefs) throw new Error("usePrefs must be used inside UserProvider");
  return prefs;
}

/** Translate UI text for the current language (MOM G3). */
export function useT() {
  const { locale } = usePrefs();
  return useCallback((key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);
}
