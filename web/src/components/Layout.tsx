import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useSession } from "../lib/store";
import { CONFIG } from "../lib/config";
import { IconLock, IconMenu, IconMonitor, IconMoon, IconSun, IconX } from "./Icons";
import "./layout.css";

// Two opposing sweeps form an open feedback loop around the subject being probed.
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M8 32C8 18.745 18.745 8 32 8h17l-9 9h-8c-8.284 0-15 6.716-15 15v17l-9-9V32Z" fill="currentColor" />
      <path d="M56 32c0 13.255-10.745 24-24 24H15l9-9h8c8.284 0 15-6.716 15-15V15l9 9v8Z" fill="var(--accent)" />
    </svg>
  );
}

const NAV = [
  { to: "/tasks", label: "Tasks", restricted: true },
  { to: "/evaluate", label: "Evaluate", restricted: true },
  { to: "/generate", label: "Generate", restricted: true },
  { to: "/analysis", label: "SAST vs Agents", restricted: true },
  { to: "/#results", label: "Results", hash: true },
];

function ThemeToggle() {
  const { theme, setTheme } = useSession();
  const next = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  const Icon = theme === "system" ? IconMonitor : theme === "light" ? IconSun : IconMoon;
  return (
    <button className="icon-btn" onClick={() => setTheme(next)} aria-label={`Theme: ${theme}. Switch to ${next}`} title={`Theme: ${theme}`}>
      <Icon width={17} height={17} />
    </button>
  );
}

export function Header() {
  const { user, selection } = useSession();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname, loc.search, loc.hash]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className={`hdr ${scrolled ? "hdr-scrolled" : ""}`}>
      <div className="wrap hdr-in">
        <Link to="/" className="brand" aria-label="SecProbe home">
          <Logo />
          <span>SecProbe</span>
        </Link>
        <nav className={`nav ${open ? "nav-open" : ""}`} aria-label="Primary">
          {NAV.map((n) =>
            n.hash ? (
              <Link key={n.to} to={n.to} className="nav-link" onClick={() => setTimeout(() => document.getElementById("results")?.scrollIntoView(), 50)}>{n.label}</Link>
            ) : (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                {n.label}{n.restricted && <IconLock width={11} height={11} aria-label="Access required" />}
                {n.to === "/evaluate" && selection.length > 0 && <span className="nav-badge num">{selection.length}</span>}
              </NavLink>
            ),
          )}
          <NavLink to="/access" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>Request access</NavLink>
          <a className="nav-link" href={CONFIG.paperUrl} target="_blank" rel="noreferrer">Paper</a>
        </nav>
        <div className="hdr-right">
          <ThemeToggle />
          {user ? (
            <Link to="/evaluate" className="avatar" title={`Signed in as ${user.login}`}>
              <img src={user.avatar_url} alt="" width={26} height={26} />
            </Link>
          ) : null}
          <button className="icon-btn menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
            {open ? <IconX width={18} height={18} /> : <IconMenu width={18} height={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="ftr">
      <div className="wrap ftr-in">
        <div className="row" style={{ gap: 12 }}>
          <Logo size={26} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>SecProbe</span>
        </div>
        <p className="faint" style={{ fontSize: 13, margin: 0, maxWidth: 560 }}>
          University of Notre Dame · Bake AI · Vanderbilt · UPenn · LMU Munich · UW · Stanford · Inria.
          Synthetic tasks for defensive evaluation only; generated vulnerable code and exploit tests are dual-use.
        </p>
        <div className="row" style={{ gap: 18, fontSize: 13 }}>
          <a href={CONFIG.paperUrl} target="_blank" rel="noreferrer">arXiv</a>
          <Link to="/access?resource=code">Code</Link>
          <Link to="/access?resource=data">Data</Link>
          <Link to="/tasks">Tasks</Link>
        </div>
      </div>
    </footer>
  );
}

export function Page({ children }: { children: ReactNode }) {
  const loc = useLocation();
  useEffect(() => {
    if (!loc.hash) window.scrollTo(0, 0);
  }, [loc.pathname, loc.hash]);
  return (
    <>
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
