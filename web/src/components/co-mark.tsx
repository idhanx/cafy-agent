// Brand mark — the Cafy bird (public/cafy-logo.svg). Matches the favicon (src/app/icon.svg).
export function CoMark({ size = 28 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/cafy-logo.svg" alt="" aria-hidden="true" width={Math.round(size * 0.92)} height={size} className="shrink-0" />;
}
