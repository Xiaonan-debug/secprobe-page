// Task content and tools require read access to the private data repo.
import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CONFIG } from "../lib/config";
import { checkAccess } from "../lib/content";
import { useSession } from "../lib/store";
import { SignIn } from "./Runner";
import { Logo } from "./Layout";
import { IconLock } from "./Icons";
import "./runner.css";

export function AccessGate({ children }: { children: ReactNode }) {
  const { token, user, signOut, authError } = useSession();
  const [check, setCheck] = useState<{ token: string | null; state: "checking" | "ok" | "denied" }>({ token: null, state: "checking" });

  useEffect(() => {
    if (CONFIG.localData) return;
    if (!token) return;
    let live = true;
    setCheck({ token, state: "checking" });
    checkAccess(token)
      .then((ok) => live && setCheck({ token, state: ok ? "ok" : "denied" }))
      .catch(() => live && setCheck({ token, state: "denied" }));
    return () => { live = false; };
  }, [token]);

  const state = check.token === token ? check.state : "checking";
  if (CONFIG.localData || (token && state === "ok")) return <>{children}</>;

  return (
    <div className="wrap gate">
      <div className="gate-card">
        <Logo size={36} />
        <p className="eyebrow" style={{ marginTop: 22 }}>Access required</p>
        <h1 className="h1" style={{ fontSize: "clamp(30px, 4vw, 42px)" }}>Explore SecProbe with approval.</h1>
        <p className="lede" style={{ marginTop: 8 }}>The paper overview is public. Task details, source code, data and evaluation tools require author approval.</p>
        <div className="row-wrap" style={{ marginTop: 22 }}>
          <Link className="btn btn-primary" to="/access?resource=tasks"><IconLock /> Request access</Link>
          <Link className="btn btn-ghost" to="/">Read the project overview</Link>
        </div>
        {!token && (
          <div className="stack" style={{ marginTop: 28 }}>
            <p className="muted" style={{ margin: 0 }}>
              <IconLock width={13} height={13} style={{ display: "inline", verticalAlign: -1 }} /> Already approved? Accept your GitHub invitation, then sign in with the account you were invited with.
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
              Request access from the authors. After approval, accept the invitation from GitHub and reload this page. Signing in alone does not grant access.
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
