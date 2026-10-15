// Minimal stroke icon set (24px grid, 1.75 stroke).
import { SVGProps } from "react";

type P = Omit<SVGProps<SVGSVGElement>, "d">;
const S = (props: P & { d: string | string[] }) => {
  const { d, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {(Array.isArray(d) ? d : [d]).map((x, i) => <path key={i} d={x} />)}
    </svg>
  );
};

export const IconPaper = (p: P) => <S {...p} d={["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z", "M14 3v5h5", "M9 13h6", "M9 17h4"]} />;
export const IconCode = (p: P) => <S {...p} d={["m8 8-4 4 4 4", "m16 8 4 4-4 4", "m14 5-4 14"]} />;
export const IconDatabase = (p: P) => <S {...p} d={["M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z", "M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6", "M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"]} />;
export const IconGithub = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
  </svg>
);
export const IconArrowRight = (p: P) => <S {...p} d={["M5 12h14", "m13 6 6 6-6 6"]} />;
export const IconArrowLeft = (p: P) => <S {...p} d={["M19 12H5", "m11 6-6 6 6 6"]} />;
export const IconSearch = (p: P) => <S {...p} d={["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z", "m20 20-3.5-3.5"]} />;
export const IconPlay = (p: P) => <S {...p} d="M7 5v14l11-7z" />;
export const IconSparkle = (p: P) => <S {...p} d={["M12 3v4", "M12 17v4", "M3 12h4", "M17 12h4", "m6 6 2.5 2.5", "m15.5 15.5 2.5 2.5", "m18 6-2.5 2.5", "M8.5 15.5 6 18"]} />;
export const IconCheck = (p: P) => <S {...p} d="m5 12.5 4.5 4.5L19 7.5" />;
export const IconX = (p: P) => <S {...p} d={["M6 6l12 12", "M18 6 6 18"]} />;
export const IconPlus = (p: P) => <S {...p} d={["M12 5v14", "M5 12h14"]} />;
export const IconMinus = (p: P) => <S {...p} d="M5 12h14" />;
export const IconFolder = (p: P) => <S {...p} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />;
export const IconFile = (p: P) => <S {...p} d={["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z", "M14 3v5h5"]} />;
export const IconChevron = (p: P) => <S {...p} d="m9 6 6 6-6 6" />;
export const IconDownload = (p: P) => <S {...p} d={["M12 4v11", "m7 10 5 5 5-5", "M5 20h14"]} />;
export const IconExternal = (p: P) => <S {...p} d={["M14 4h6v6", "M20 4 11 13", "M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"]} />;
export const IconKey = (p: P) => <S {...p} d={["M15 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0z", "m14 12 7 7", "m18 16 2-2", "m16 18 1.5-1.5"]} />;
export const IconShield = (p: P) => <S {...p} d={["M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z", "m9 12 2 2 4-4"]} />;
export const IconCopy = (p: P) => <S {...p} d={["M9 9h10v10H9z", "M5 15V5h10"]} />;
export const IconSun = (p: P) => <S {...p} d={["M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M12 2v2", "M12 20v2", "m4.9 4.9 1.4 1.4", "m17.7 17.7 1.4 1.4", "M2 12h2", "M20 12h2", "m4.9 19.1 1.4-1.4", "m17.7 6.3 1.4-1.4"]} />;
export const IconMoon = (p: P) => <S {...p} d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />;
export const IconMonitor = (p: P) => <S {...p} d={["M3 5h18v11H3z", "M8 20h8", "M12 16v4"]} />;
export const IconRefresh = (p: P) => <S {...p} d={["M20 11a8 8 0 0 0-14.8-3.8L4 9", "M4 4v5h5", "M4 13a8 8 0 0 0 14.8 3.8L20 15", "M20 20v-5h-5"]} />;
export const IconStop = (p: P) => <S {...p} d="M7 7h10v10H7z" />;
export const IconMenu = (p: P) => <S {...p} d={["M4 7h16", "M4 12h16", "M4 17h16"]} />;
export const IconLock = (p: P) => <S {...p} d={["M6 11h12v9H6z", "M8 11V8a4 4 0 0 1 8 0v3"]} />;
