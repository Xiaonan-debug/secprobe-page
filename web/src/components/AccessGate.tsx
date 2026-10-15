// Everything on the site is private: visitors must sign in with GitHub and have read access to the data repo.
import { ReactNode, useEffect, useState } from "react";
import { CONFIG } from "../lib/config";
import { checkAccess } from "../lib/content";
import { useSession } from "../lib/store";
import { SignIn } from "./Runner";
import { Logo } from "./Layout";
import { IconLock } from "./Icons";
import "./runner.css";

export function AccessGate({ children }: { children: ReactNode }) {
  const { token, user, signOut, authError } = useSession();
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    if (CONFIG.localData) { setState("ok"); return; }
    if (!token) return;
    let live = true;
    setState("checking");
    checkAccess(token).then((ok) => live && setState(ok ? "ok" : "denied")).catch(() => live && setState("denied"));
    return () => { live = false; };
  }, [token]);

  if (CONFIG.localData || (token && state === "ok")) return <>{children}</>;

  return (
    <div className="wrap gate">
      <div className="gate-card">
        <Logo size={36} />
        <p className="eyebrow" style={{ marginTop: 22 }}>Private preview</p>
        <h1 className="h1" style={{ fontSize: "clamp(30px, 4vw, 42px)" }}>SecProbe</h1>
        <p className="lede" style={{ marginTop: 8 }}>Adaptive evaluation of coding agents on cybersecurity vulnerabilities.</p>
        {!token && (
          <div className="stack" style={{ marginTop: 28 }}>
            <p className="muted" style={{ margin: 0 }}>
              <IconLock width={13} height={13} style={{ display: "inline", verticalAlign: -1 }} /> Access is limited to invited collaborators. Sign in with the GitHub account you were invited with.
            </p>
            {authError && <div className="alert alert-err">{authError}</div>}
            <SignIn />
          </div>
        )}
        {token && state === "checking" && <div className="row muted" style={{ marginTop: 28 }}><div className="spinner" /> Checking access…</div>}
        {token && state === "denied" && (
          <div className="stack" style={{ marginTop: 28 }}>
            <div className="alert alert-warn">
              {user ? <>The GitHub account <b>{user.login}</b> doesn't have access yet.</> : <>This GitHub account doesn't have access yet.</>}{" "}
              Ask the authors to add you as a collaborator, then accept the invitation from GitHub and reload this page.
            </div>
            <div className="row-wrap">
              <button className="btn" onClick={() => location.reload()}>I accepted the invitation — reload</button>
              <button className="btn btn-ghost" onClick={signOut}>Use a different account</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
