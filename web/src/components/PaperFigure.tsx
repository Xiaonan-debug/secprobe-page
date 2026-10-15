import { CONFIG } from "../lib/config";
import { IconExternal } from "./Icons";
import "./paper-figure.css";

export function PaperFigure({ file, number, title, caption, width, height }: {
  file: string;
  number: number;
  title: string;
  caption: string;
  width: number;
  height: number;
}) {
  const src = `${import.meta.env.BASE_URL}paper/${file}`;
  return (
    <figure className="paper-figure">
      <a className="paper-figure-image" href={src} target="_blank" rel="noreferrer" aria-label={`Open Figure ${number}: ${title} at full size`}>
        <img src={src} alt={caption} width={width} height={height} loading="lazy" decoding="async" />
        <span className="paper-figure-zoom"><IconExternal width={13} height={13} /> Open full size</span>
      </a>
      <figcaption>
        <span className="paper-figure-number">Figure {number}</span>
        <div className="paper-figure-copy"><strong>{title}</strong><p>{caption}</p></div>
        <a className="paper-figure-source" href={CONFIG.paperUrl} target="_blank" rel="noreferrer">From the paper <IconExternal width={12} height={12} /></a>
      </figcaption>
    </figure>
  );
}
