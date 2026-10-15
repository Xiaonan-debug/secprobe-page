// Deployment settings. Each can be overridden at build time with the matching VITE_* variable.
const env = import.meta.env;

export const CONFIG = {
  /** GitHub template repo users copy to get their own runner. */
  templateRepo: (env.VITE_TEMPLATE_REPO as string) || "Xiaonan-debug/secprobe-runner-template",
  /** Name given to the user's copy. */
  runnerRepoName: (env.VITE_RUNNER_REPO_NAME as string) || "secprobe-runner",
  /** GitHub OAuth App client id (public). Empty → only the token sign-in path is offered. */
  githubClientId: (env.VITE_GITHUB_CLIENT_ID as string) || "",
  /** SecProbe API worker: OAuth code exchange + hosted task generation. */
  apiBase: ((env.VITE_API_BASE as string) || (env.VITE_AUTH_WORKER as string) || "").replace(/\/$/, ""),
  /** Public repo where hosted generations publish progress, tasks and bundles. */
  generatedRepo: (env.VITE_GENERATED_REPO as string) || "Xiaonan-debug/secprobe-generated",
  /** Hugging Face dataset holding the full Harbor task bundles. */
  hfDataset: (env.VITE_HF_DATASET as string) || "xluobd/SecProbe-353",
  /** Private repository holding all site content; read access to it is what grants access to the site. */
  dataRepo: (env.VITE_DATA_REPO as string) || "Xiaonan-debug/secprobe-data",
  /** Development/preview only: read data from web/public/data instead of the private repo. */
  localData: env.VITE_LOCAL_DATA === "1",
  paperUrl: "https://arxiv.org/abs/2609.33763",
  pdfUrl: "https://arxiv.org/pdf/2609.33763",
  codeUrl: (env.VITE_CODE_URL as string) || "https://github.com/Xiaonan-debug/secprobe-page",
  resultsBranch: "secprobe-results",
};

export const hfFileUrl = (path: string) =>
  `https://huggingface.co/datasets/${CONFIG.hfDataset}/resolve/main/${path}`;
export const hfDatasetUrl = () => `https://huggingface.co/datasets/${CONFIG.hfDataset}`;
