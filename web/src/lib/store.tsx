// App-wide state: GitHub session, runner repo, and the task selection ("evaluation set").
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { GitHub, GhUser, completeOAuth } from "./github";
import { CONFIG } from "./config";
import { setContentToken } from "./content";

interface Session {
  token: string | null;
  user: GhUser | null;
  gh: GitHub | null;
  repo: string | null; // "<login>/secprobe-runner" once it exists
  authError: string | null;
  signIn: (token: string, remember: boolean) => Promise<void>;
  signOut: () => void;
  setRepo: (full: string | null) => void;
  selection: string[];
  toggle: (id: string) => void;
  setSelection: (ids: string[]) => void;
  theme: "system" | "light" | "dark";
  setTheme: (t: "system" | "light" | "dark") => void;
}

const Ctx = createContext<Session | null>(null);

const TOKEN_KEY = "secprobe.gh.token";
const REPO_KEY = "secprobe.gh.repo";
const SEL_KEY = "secprobe.selection";
const THEME_KEY = "secprobe.theme";

const get = (s: Storage, k: string) => { try { return s.getItem(k); } catch { return null; } };
const set = (s: Storage, k: string, v: string | null) => {
  try { if (v == null) s.removeItem(k); else s.setItem(k, v); } catch { /* ignore */ }
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => get(sessionStorage, TOKEN_KEY) ?? get(localStorage, TOKEN_KEY));
  const [user, setUser] = useState<GhUser | null>(null);
  const [repo, setRepoState] = useState<string | null>(() => get(localStorage, REPO_KEY));
  const [authError, setAuthError] = useState<string | null>(null);
  const [selection, setSel] = useState<string[]>(() => {
    try { return JSON.parse(get(localStorage, SEL_KEY) || "[]"); } catch { return []; }
  });
  const [theme, setThemeState] = useState<"system" | "light" | "dark">(
    () => (get(localStorage, THEME_KEY) as "light" | "dark" | null) ?? "system",
  );

  const gh = useMemo(() => {
    setContentToken(token);
    return token ? new GitHub(token) : null;
  }, [token]);

  useEffect(() => {
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Finish an OAuth redirect if we just came back from GitHub.
  useEffect(() => {
    completeOAuth()
      .then((r) => { if (r) { set(sessionStorage, TOKEN_KEY, r.token); setToken(r.token); } })
      .catch((e) => setAuthError(String(e.message || e)));
  }, []);

  useEffect(() => {
    if (!gh) { setUser(null); return; }
    let live = true;
    gh.user()
      .then((u) => {
        if (!live) return;
        setUser(u);
        const stored = get(localStorage, REPO_KEY);
        if (stored && !stored.toLowerCase().startsWith(u.login.toLowerCase() + "/")) {
          set(localStorage, REPO_KEY, null);
          setRepoState(null);
        }
      })
      .catch(() => {
        if (!live) return;
        setAuthError("Your GitHub session expired. Please sign in again.");
        set(sessionStorage, TOKEN_KEY, null);
        set(localStorage, TOKEN_KEY, null);
        setToken(null);
      });
    return () => { live = false; };
  }, [gh]);

  const signIn = useCallback(async (t: string, remember: boolean) => {
    const probe = new GitHub(t);
    await probe.user();
    set(remember ? localStorage : sessionStorage, TOKEN_KEY, t);
    setAuthError(null);
    setToken(t);
  }, []);

  const signOut = useCallback(() => {
    set(sessionStorage, TOKEN_KEY, null);
    set(localStorage, TOKEN_KEY, null);
    setToken(null);
    setUser(null);
  }, []);

  const setRepo = useCallback((full: string | null) => { set(localStorage, REPO_KEY, full); setRepoState(full); }, []);

  const persistSel = (ids: string[]) => { set(localStorage, SEL_KEY, JSON.stringify(ids)); return ids; };
  const toggle = useCallback((id: string) => {
    setSel((s) => persistSel(s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }, []);
  const setSelection = useCallback((ids: string[]) => setSel(persistSel(Array.from(new Set(ids)))), []);
  const setTheme = useCallback((t: "system" | "light" | "dark") => { set(localStorage, THEME_KEY, t === "system" ? null : t); setThemeState(t); }, []);

  const value: Session = {
    token, user, gh, repo, authError, signIn, signOut, setRepo,
    selection, toggle, setSelection, theme, setTheme,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside provider");
  return v;
}

export const defaultRunnerRepo = (login: string) => `${login}/${CONFIG.runnerRepoName}`;
