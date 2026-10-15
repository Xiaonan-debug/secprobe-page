import { useMemo } from "react";
import { renderToString } from "katex";
import "katex/dist/katex.min.css";
import "./math.css";

/** Typeset an authored TeX expression, including MathML for assistive technology. */
export function Math({ tex, display = false, className = "" }: { tex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => renderToString(tex, {
    displayMode: display,
    output: "htmlAndMathml",
    throwOnError: false,
    strict: "error",
    trust: false,
  }), [tex, display]);
  const Tag = display ? "div" : "span";
  return <Tag className={`math ${display ? "math-display" : "math-inline"} ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
