import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CONFIG, hfDatasetUrl } from "../lib/config";
import { IconArrowLeft, IconArrowRight, IconCode, IconDatabase, IconExternal, IconLock } from "../components/Icons";
import "./access.css";

const RESOURCES = [
  { id: "tasks", title: "Task details", description: "Task instructions, repository files and task-level analysis.", icon: IconLock },
  { id: "code", title: "Code", description: "SecProbe implementation and evaluation tools.", icon: IconCode },
  { id: "data", title: "Dataset", description: "Task bundles and evaluation data.", icon: IconDatabase },
] as const;
type Resource = typeof RESOURCES[number]["id"];
const isResource = (value: string | null): value is Resource => RESOURCES.some((resource) => resource.id === value);

export default function Access() {
  const [params] = useSearchParams();
  const requested = params.get("resource");
  const [resources, setResources] = useState<Resource[]>([isResource(requested) ? requested : "tasks"]);
  const [username, setUsername] = useState("");
  const [intendedUse, setIntendedUse] = useState("");
  const [resourceError, setResourceError] = useState(false);
  const emailRequest = CONFIG.accessRequestUrl.startsWith("mailto:");
  const githubRequest = new URL(CONFIG.accessRequestUrl, window.location.origin).hostname === "github.com";

  useEffect(() => {
    if (isResource(requested)) {
      setResources([requested]);
      setResourceError(false);
    }
  }, [requested]);

  function toggleResource(resource: Resource) {
    setResources((current) => current.includes(resource) ? current.filter((item) => item !== resource) : [...current, resource]);
    setResourceError(false);
  }

  function openRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resources.length) {
      setResourceError(true);
      return;
    }
    const selected = RESOURCES.filter((resource) => resources.includes(resource.id)).map((resource) => resource.title);
    const title = `SecProbe access request: ${selected.join(", ")}`;
    const body = [
      "## Requested resources",
      selected.map((resource) => `- ${resource}`).join("\n"),
      "",
      "## GitHub username",
      username.trim().replace(/^@/, "") || "Not provided",
      "",
      "## Intended use",
      intendedUse.trim(),
    ].join("\n");
    const destination = new URL(CONFIG.accessRequestUrl, window.location.origin);
    destination.searchParams.set(emailRequest ? "subject" : "title", title);
    destination.searchParams.set("body", body);
    // Mail clients expect percent-encoded spaces rather than form-encoded plus signs.
    if (emailRequest) destination.search = destination.searchParams.toString().replace(/\+/g, "%20");
    window.location.assign(destination.toString());
  }

  return (
    <div className="wrap access-page">
      <Link className="back-link" to="/"><IconArrowLeft width={14} height={14} /> Back to the project</Link>
      <div className="access-heading">
        <p className="eyebrow">SecProbe · Research access</p>
        <h1 className="h1">Request access</h1>
        <p className="lede">The paper and project overview are public. Access to task details, code and data requires approval from the authors.</p>
      </div>

      <div className="access-grid">
        <form className="access-form card" onSubmit={openRequest}>
          <fieldset className="access-resources" aria-describedby={resourceError ? "access-resource-error" : undefined}>
            <legend className="label">Which resources do you need?</legend>
            <div className="access-options">
              {RESOURCES.map(({ id, title, description, icon: Icon }) => (
                <label className={`access-option${resources.includes(id) ? " selected" : ""}`} key={id}>
                  <input type="checkbox" name="resources" value={id} checked={resources.includes(id)} onChange={() => toggleResource(id)} />
                  <Icon width={19} height={19} />
                  <span><strong>{title}</strong><span className="hint">{description}</span></span>
                </label>
              ))}
            </div>
            {resourceError && <p className="access-error" id="access-resource-error" role="alert">Select at least one resource.</p>}
          </fieldset>

          <div className="field">
            <label htmlFor="access-github">GitHub username <span className="muted">(optional)</span></label>
            <input className="input" id="access-github" name="github" autoComplete="username" placeholder="Your GitHub username" value={username} onChange={(event) => setUsername(event.target.value)} maxLength={100} />
            <span className="hint">Include the account you will use to access approved repositories.</span>
          </div>
          <div className="field">
            <label htmlFor="access-purpose">Intended use <span className="muted">(required)</span></label>
            <textarea className="textarea access-purpose" id="access-purpose" name="purpose" required maxLength={3000} rows={5} placeholder="Briefly describe your research or evaluation plans and the resources you need." value={intendedUse} onChange={(event) => {
              setIntendedUse(event.target.value);
              event.target.setCustomValidity(event.target.value.trim() ? "" : "Please describe your intended use.");
            }} />
          </div>

          <div className="access-draft-note">
            {emailRequest
              ? "This opens a draft in your email app for you to review and send. Requests are reviewed manually; approval is not automatic."
              : githubRequest ? "This opens a prefilled GitHub issue for you to review and submit. Issues in this repository are public, so omit confidential information. Requests are reviewed manually; approval is not automatic."
                : "This opens the authors’ request form for you to review and submit. Requests are reviewed manually; approval is not automatic."}
          </div>
          <button className="btn btn-primary" type="submit">{emailRequest ? "Draft request email" : githubRequest ? "Open request on GitHub" : "Open request form"} <IconExternal /></button>
        </form>

        <aside className="access-aside">
          <div>
            <h2 className="h3">Already approved?</h2>
            <p className="muted">Accept the repository invitation from GitHub, then sign in with the invited account. GitHub sign-in alone does not grant access.</p>
            <Link className="btn" to="/tasks">Open task explorer <IconArrowRight /></Link>
          </div>
          {resources.includes("data") && (
            <div className="access-dataset">
              <h2 className="h3">Dataset access</h2>
              <p className="muted">You can also request access on the gated Hugging Face dataset page. Dataset approval is reviewed separately.</p>
              <a className="access-text-link" href={hfDatasetUrl()} target="_blank" rel="noreferrer">Request dataset access on Hugging Face <IconExternal width={14} height={14} /></a>
            </div>
          )}
          <a className="access-text-link muted" href={CONFIG.paperUrl} target="_blank" rel="noreferrer">Read the public paper <IconExternal width={14} height={14} /></a>
        </aside>
      </div>
    </div>
  );
}
