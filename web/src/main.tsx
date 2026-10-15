import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/jetbrains-mono";
import "./styles/global.css";
import { SessionProvider } from "./lib/store";
import { Page } from "./components/Layout";
import { AccessGate } from "./components/AccessGate";
import Home from "./pages/Home";

// After a redeploy, an open tab may request chunk files that no longer exist: reload once to pick up the new build.
window.addEventListener("vite:preloadError", (e) => {
  const key = "secprobe.reloaded-for-update";
  if (sessionStorage.getItem(key) === location.href) return;
  sessionStorage.setItem(key, location.href);
  e.preventDefault();
  location.reload();
});

const Tasks = lazy(() => import("./pages/Tasks"));
const TaskPage = lazy(() => import("./pages/TaskPage"));
const Evaluate = lazy(() => import("./pages/Evaluate"));
const EvalRun = lazy(() => import("./pages/EvalRun"));
const Generate = lazy(() => import("./pages/Generate"));
const GenRun = lazy(() => import("./pages/GenRun"));
const AnalysisPage = lazy(() => import("./pages/Analysis"));

function NotFound() {
  return (
    <div className="wrap" style={{ padding: "100px 0" }}>
      <p className="eyebrow">404</p>
      <h1 className="h1">Nothing here.</h1>
      <p><a href="#/">Back to SecProbe</a></p>
    </div>
  );
}

const Loading = () => <div className="wrap" style={{ padding: "80px 0" }}><div className="spinner" /></div>;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <HashRouter>
        <Page>
          <AccessGate>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/tasks/:id" element={<TaskPage />} />
              <Route path="/evaluate" element={<Evaluate />} />
              <Route path="/evaluate/:rid" element={<EvalRun />} />
              <Route path="/generate" element={<Generate />} />
              <Route path="/generate/:rid" element={<GenRun />} />
              <Route path="/analysis" element={<AnalysisPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </AccessGate>
        </Page>
      </HashRouter>
    </SessionProvider>
  </StrictMode>,
);
