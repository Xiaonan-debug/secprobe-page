// One-time setup of the visitor's own runner (GitHub sign-in → runner repo → API keys),
// rendered as a step list until everything is ready.
import { ReactNode, useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { CONFIG } from "../lib/config";
import { GitHub, GitHubError, beginOAuth, oauthAvailable } from "../lib/github";
import { defaultRunnerRepo, useSession } from "../lib/store";
import { PROVIDERS } from "../lib/runner";
import { IconCheck, IconExternal, IconGithub, IconKey, IconLock, IconShield, IconX } from "./Icons";
import "./runner.css";

export interface RunnerCtx { gh: GitHub; repo: string; secrets: string[]; refreshSecrets: () => Promise<void>; need?: string }

export function RunnerGate({ children, need }: { children: (ctx: RunnerCtx) => ReactNode; need?: string }) {
  const { gh, user, repo, setRepo, authError } = useSession();
  const [secrets, setSecrets] = useState<string[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Auto-detect an existing runner repo after sign-in.
  useEffect(() => {
    if (!gh || !user || repo) return;
    let live = true;
    setChecking(true);
    gh.repo(defaultRunnerRepo(user.login))
      .then((r) => { if (live && r) setRepo(r.full_name); })
      .catch(() => {})
      .finally(() => live && setChecking(false));
    return () => { live = false; };
  }, [gh, user, repo, setRepo]);

  const refreshSecrets = useCallback(async () => {
    if (!gh || !repo) return;
    try { setSecrets(await gh.secretNames(repo)); setErr(null); }
    catch (e) {
      if (e instanceof GitHubError && e.status === 404) { setRepo(null); return; }
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [gh, repo, setRepo]);

  useEffect(() => { setSecrets(null); refreshSecrets(); }, [refreshSecrets]);

  const step = !gh || !user ? 1 : !repo ? 2 : !secrets ? 3 : secrets.some((s) => s.endsWith("_API_KEY")) ? 4 : 3;

  if (step === 4 && gh && repo && secrets) {
    return <>{children({ gh, repo, secrets, refreshSecrets, need })}</>;
  }

  return (
    <div className="setup">
      <div className="setup-intro">
        <p className="eyebrow">One-time setup · about a minute</p>
        <h2 className="h2">Runs execute on your GitHub Actions, with your API keys.</h2>
        <p className="muted" style={{ maxWidth: 640 }}>
          SecProbe has no server that sees your keys. We create a small runner repository in your GitHub account; its workflows build each task's Docker image,
          run the agent, grade it and send the results back here. Keys are encrypted in your browser and stored as that repository's Actions secrets.
        </p>
      </div>
      {(authError || err) && <div className="alert alert-err">{authError || err}</div>}
      <ol className="steps">
        <Step n={1} state={step > 1 ? "done" : "active"} title="Sign in with GitHub" done={user ? <span className="row" style={{ gap: 8 }}><img src={user.avatar_url} width={20} height={20} style={{ borderRadius: "50%" }} alt="" /> {user.login}</span> : undefined}>
          {step === 1 && <SignIn />}
        </Step>
        <Step n={2} state={step > 2 ? "done" : step === 2 ? "active" : "todo"} title="Create your runner repository" done={repo ? <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer" className="mono">{repo}</a> : undefined}>
          {step === 2 && (checking ? <div className="row muted"><div className="spinner" /> Looking for an existing runner…</div> : <CreateRunner />)}
        </Step>
        <Step n={3} state={step > 3 ? "done" : step === 3 ? "active" : "todo"} title="Add a model provider key">
          {step === 3 && gh && repo && (secrets ? <Keys gh={gh} repo={repo} secrets={secrets} onChange={refreshSecrets} need={need} /> : <div className="row muted"><div className="spinner" /> Checking secrets…</div>)}
        </Step>
      </ol>
    </div>
  );
}

function Step({ n, state, title, done, children }: { n: number; state: "done" | "active" | "todo"; title: string; done?: ReactNode; children?: ReactNode }) {
  return (
    <li className={`step step-${state}`}>
      <div className="step-n">{state === "done" ? <IconCheck width={14} height={14} /> : n}</div>
      <div className="step-body">
        <div className="step-title">{title}{state === "done" && done && <span className="step-done">{done}</span>}</div>
        {children && <div className="step-content">{children}</div>}
      </div>
    </li>
  );
}

export function SignIn() {
  const { signIn } = useSession();
  const loc = useLocation();
  const [showToken, setShowToken] = useState(!oauthAvailable());
  const [token, setToken] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const patUrl = `https://github.com/settings/tokens/new?scopes=repo,workflow&description=${encodeURIComponent("SecProbe runner")}`;

  return (
    <div className="stack">
      {oauthAvailable() && (
        <div className="row-wrap">
          <button className="btn btn-primary" onClick={() => beginOAuth("#" + loc.pathname + loc.search)}><IconGithub /> Continue with GitHub</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowToken((s) => !s)}>{showToken ? "Hide" : "Use a token instead"}</button>
        </div>
      )}
      {showToken && (
        <div className="stack" style={{ gap: 10 }}>
          <p className="hint" style={{ margin: 0 }}>
            Create a <a href={patUrl} target="_blank" rel="noreferrer">classic token with <code>repo</code> and <code>workflow</code> scopes <IconExternal width={11} height={11} style={{ display: "inline" }} /></a>, or a
            {" "}<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">fine-grained token</a> with
            Administration, Actions, Contents, Secrets and Workflows (read &amp; write). It stays in this browser and is sent only to api.github.com.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <input className="input mono" type="password" autoComplete="off" spellCheck={false} placeholder="ghp_… or github_pat_…" value={token} onChange={(e) => setToken(e.target.value.trim())} />
            <button className="btn btn-primary" disabled={!token || busy}
              onClick={async () => { setBusy(true); setErr(null); try { await signIn(token, remember); } catch (e) { setErr(e instanceof Error ? e.message : "Invalid token"); } finally { setBusy(false); } }}>
              {busy ? <div className="spinner" /> : "Connect"}
            </button>
          </div>
          <label className="row hint" style={{ gap: 8 }}><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember on this device</label>
          {err && <div className="alert alert-err">{err}</div>}
        </div>
      )}
      <p className="hint" style={{ margin: 0 }}><IconLock width={12} height={12} style={{ display: "inline", verticalAlign: -1 }} /> Permissions are used only to identify you and, for Evaluate, to create your runner repository, store its secrets, start its workflows and read its results.</p>
    </div>
  );
}

function CreateRunner() {
  const { gh, user, setRepo } = useSession();
  // Private preview: runner results include task code (agent patches), so runners are always private.
  const priv = true;
  const [phase, setPhase] = useState<"idle" | "creating" | "waiting">("idle");
  const [err, setErr] = useState<string | null>(null);

  const create = async () => {
    if (!gh || !user) return;
    setErr(null);
    setPhase("creating");
    try {
      const r = await gh.createRunner(user.login, CONFIG.runnerRepoName, priv);
      setPhase("waiting");
      for (let i = 0; i < 30; i++) {
        if (await gh.workflowsReady(r.full_name)) break;
        await new Promise((res) => setTimeout(res, 2000));
      }
      setRepo(r.full_name);
    } catch (e) {
      setErr(e instanceof GitHubError && e.status === 422 ? `A repository named ${CONFIG.runnerRepoName} already exists but could not be used. Rename or delete it and retry.` : e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  };

  return (
    <div className="stack">
      <p className="hint" style={{ margin: 0 }}>
        The runner is created as a <b>private</b> repository: its results contain task code, which must stay private during the preview.
        Private repositories use your plan's Actions minutes (2,000 free per month on GitHub Free).
      </p>
      <div className="row-wrap">
        <button className="btn btn-primary" onClick={create} disabled={phase !== "idle"}>
          {phase === "idle" ? <>Create <span className="mono">{user?.login}/{CONFIG.runnerRepoName}</span></> : <><div className="spinner" /> {phase === "creating" ? "Creating repository…" : "Waiting for workflows…"}</>}
        </button>
        <a className="hint" href={`https://github.com/${CONFIG.templateRepo}`} target="_blank" rel="noreferrer">Inspect the template</a>
      </div>
      {err && <div className="alert alert-err">{err}</div>}
    </div>
  );
}

export function Keys({ gh, repo, secrets, onChange, need, compact }: { gh: GitHub; repo: string; secrets: string[]; onChange: () => Promise<void>; need?: string; compact?: boolean }) {
  const [provider, setProvider] = useState(() => PROVIDERS.find((p) => p.secret === need)?.id ?? "openrouter");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const p = PROVIDERS.find((x) => x.id === provider)!;
  const stored = PROVIDERS.filter((x) => secrets.includes(x.secret));

  useEffect(() => { const n = PROVIDERS.find((x) => x.secret === need); if (n) setProvider(n.id); }, [need]);

  const save = async () => {
    setBusy(true); setErr(null);
    try { await gh.putSecret(repo, p.secret, value); setValue(""); await onChange(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="stack keys">
      {stored.length > 0 && (
        <div className="row-wrap">
          {stored.map((x) => (
            <span key={x.id} className="chip chip-ok">
              <IconKey width={12} height={12} /> {x.label}
              <button className="chip-x" aria-label={`Remove ${x.label} key`} onClick={async () => { if (confirm(`Remove the ${x.label} key from ${repo}?`)) { await gh.deleteSecret(repo, x.secret); await onChange(); } }}>
                <IconX width={11} height={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className={`keys-form ${compact ? "compact" : ""}`}>
        <select className="select" value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Provider">
          {PROVIDERS.map((x) => <option key={x.id} value={x.id}>{x.label}{secrets.includes(x.secret) ? " ✓" : ""}</option>)}
        </select>
        <input className="input mono" type="password" autoComplete="off" spellCheck={false} placeholder={p.placeholder} value={value} onChange={(e) => setValue(e.target.value.trim())} aria-label={`${p.label} API key`} />
        <button className="btn btn-primary" disabled={!value || busy} onClick={save}>{busy ? <div className="spinner" /> : secrets.includes(p.secret) ? "Replace" : "Save key"}</button>
      </div>
      <p className="hint" style={{ margin: 0 }}>
        <IconShield width={12} height={12} style={{ display: "inline", verticalAlign: -1 }} /> Encrypted in your browser with the repository's public key (libsodium sealed box) and stored as <code>{p.secret}</code>. Neither this site nor GitHub can display it again.
        {" "}<a href={p.keyUrl} target="_blank" rel="noreferrer">Get a {p.label} key</a>.
        {p.id === "openrouter" && " One OpenRouter key covers every model in the paper."}
      </p>
      {err && <div className="alert alert-err">{err}</div>}
    </div>
  );
}

/** Sign-in only (identity), used by hosted generation. */
export function SignInGate({ children, why }: { children: (gh: GitHub, login: string) => ReactNode; why: ReactNode }) {
  const { gh, user, authError } = useSession();
  if (gh && user) return <>{children(gh, user.login)}</>;
  return (
    <div className="setup">
      {authError && <div className="alert alert-err">{authError}</div>}
      <ol className="steps">
        <Step n={1} state="active" title="Sign in with GitHub">
          <div className="stack">
            <p className="hint" style={{ margin: 0 }}>{why}</p>
            <SignIn />
          </div>
        </Step>
      </ol>
    </div>
  );
}

/** Compact status strip shown above evaluate once setup is complete. */
export function RunnerBar({ ctx }: { ctx: RunnerCtx }) {
  const { user, signOut, setRepo } = useSession();
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<{ mine: string; latest: string } | null>(null);
  const [updating, setUpdating] = useState<"idle" | "busy" | "done">("idle");
  const [updateErr, setUpdateErr] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([ctx.gh.runnerVersion(ctx.repo), ctx.gh.runnerVersion(CONFIG.templateRepo)])
      .then(([mine, latest]) => setVersions({ mine, latest }))
      .catch(() => {});
  }, [ctx]);
  const outdated = versions && Number(versions.mine) < Number(versions.latest) && updating !== "done";
  useEffect(() => { if (ctx.need) setOpen(true); }, [ctx.need]);
  const keys = PROVIDERS.filter((p) => ctx.secrets.includes(p.secret));
  return (
    <div className="runner-bar">
      <div className="row-wrap" style={{ gap: 14 }}>
        <span className="live-dot" style={{ animation: "none", background: "var(--ok)" }} />
        <span style={{ fontSize: 13.5 }}>Runner <a className="mono" href={`https://github.com/${ctx.repo}`} target="_blank" rel="noreferrer">{ctx.repo}</a></span>
        <span className="faint" style={{ fontSize: 13 }}>{keys.map((k) => k.label).join(" · ") || "no keys"}</span>
        <span className="spacer" />
        <button className="btn btn-sm btn-ghost" onClick={() => setOpen((o) => !o)}>{open ? "Done" : "Manage keys"}</button>
        <button className="btn btn-sm btn-ghost" onClick={() => { setRepo(null); signOut(); }} title={`Signed in as ${user?.login}`}>Sign out</button>
      </div>
      {outdated && (
        <div className="alert alert-info row-wrap" style={{ marginTop: 12 }}>
          <span>A newer runner is available (v{versions!.mine} → v{versions!.latest}): scores now appear as soon as each task is graded.</span>
          <span className="spacer" />
          <button className="btn btn-sm" disabled={updating === "busy"} onClick={async () => {
            setUpdating("busy"); setUpdateErr(null);
            try { await ctx.gh.syncFromTemplate(ctx.repo); setUpdating("done"); }
            catch (e) { setUpdateErr(e instanceof Error ? e.message : String(e)); setUpdating("idle"); }
          }}>{updating === "busy" ? <div className="spinner" /> : "Update runner"}</button>
        </div>
      )}
      {updating === "done" && <div className="alert alert-info" style={{ marginTop: 12 }}>Runner updated. New evaluations use the latest version.</div>}
      {updateErr && <div className="alert alert-err" style={{ marginTop: 12 }}>Update failed: {updateErr}</div>}
      {open && <div style={{ marginTop: 14 }}><Keys gh={ctx.gh} repo={ctx.repo} secrets={ctx.secrets} onChange={ctx.refreshSecrets} need={ctx.need} compact /></div>}
    </div>
  );
}
