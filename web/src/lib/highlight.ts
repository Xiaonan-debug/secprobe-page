// Lazy Shiki highlighter with a dual light/dark theme driven by CSS variables.
import type { HighlighterCore } from "shiki/core";

const LANGS: Record<string, () => Promise<unknown>> = {
  python: () => import("shiki/langs/python.mjs"),
  go: () => import("shiki/langs/go.mjs"),
  cpp: () => import("shiki/langs/cpp.mjs"),
  java: () => import("shiki/langs/java.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  rust: () => import("shiki/langs/rust.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  make: () => import("shiki/langs/make.mjs"),
  dockerfile: () => import("shiki/langs/dockerfile.mjs"),
  shellscript: () => import("shiki/langs/shellscript.mjs"),
  xml: () => import("shiki/langs/xml.mjs"),
  ini: () => import("shiki/langs/ini.mjs"),
  diff: () => import("shiki/langs/diff.mjs"),
};

let core: Promise<HighlighterCore> | null = null;
const loaded = new Set<string>();

function highlighter() {
  if (!core) {
    core = (async () => {
      const [{ createHighlighterCore }, { createOnigurumaEngine }, light, dark] = await Promise.all([
        import("shiki/core"),
        import("shiki/engine/oniguruma"),
        import("shiki/themes/github-light.mjs"),
        import("shiki/themes/github-dark-dimmed.mjs"),
      ]);
      return createHighlighterCore({
        themes: [light.default, dark.default],
        langs: [],
        engine: createOnigurumaEngine(import("shiki/wasm")),
      });
    })();
  }
  return core;
}

const MAX_HIGHLIGHT = 160_000;

/** Returns highlighted HTML lines, or null if the language is unknown / file too large. */
export async function highlightLines(code: string, lang: string): Promise<string[] | null> {
  if (!LANGS[lang] || code.length > MAX_HIGHLIGHT) return null;
  const hl = await highlighter();
  if (!loaded.has(lang)) {
    const mod = (await LANGS[lang]()) as { default: Parameters<HighlighterCore["loadLanguage"]>[0] };
    await hl.loadLanguage(mod.default);
    loaded.add(lang);
  }
  const tokens = hl.codeToTokens(code, { lang, themes: { light: "github-light", dark: "github-dark-dimmed" } });
  return tokens.tokens.map((line) =>
    line
      .map((t) => {
        const style = Object.entries(t.htmlStyle ?? {}).map(([k, v]) => `${k}:${v}`).join(";");
        return `<span style="${style}">${escapeHtml(t.content)}</span>`;
      })
      .join(""),
  );
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
