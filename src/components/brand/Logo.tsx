import { WORDMARK_AGENDA, WORDMARK_CLANIX, WORDMARK_WIDTH } from './wordmark-paths';

export type LogoVariant = 'icon' | 'icon-dark' | 'full' | 'full-dark' | 'mono';

function Mark({ variant }: { variant: LogoVariant }) {
  const mono = variant === 'mono';
  const dark = variant === 'icon-dark' || variant === 'full-dark';
  const tile = mono ? 'currentColor' : dark ? '#24497F' : '#0F2D5B';
  const cal = mono ? 'var(--logo-bg, #FFFFFF)' : '#FFFFFF';
  const blue = mono ? 'currentColor' : '#3B82F6';
  const light = mono ? 'currentColor' : '#93C5FD';
  const badge = mono ? 'currentColor' : '#0F2D5B';
  return (
    <>
      <rect width="64" height="64" rx="16" fill={tile} />
      <g fill={cal}>
        <rect x="12" y="16" width="40" height="34" rx="7" />
        <rect x="20" y="11" width="4" height="10" rx="2" />
        <rect x="30" y="11" width="4" height="10" rx="2" />
        <rect x="40" y="11" width="4" height="10" rx="2" />
      </g>
      <rect x="17" y="25" width="8" height="8" rx="2" fill={blue} />
      <rect x="27" y="25" width="8" height="8" rx="2" fill={light} />
      <rect x="17" y="35" width="8" height="8" rx="2" fill={light} />
      <rect x="27" y="35" width="8" height="8" rx="2" fill={blue} />
      <rect x="37" y="29" width="11" height="11" rx="3" fill={badge} />
      <path
        d="m39.5 34.5 2.2 2.2 4-4.2"
        fill="none"
        stroke={mono ? 'var(--logo-bg, #FFFFFF)' : '#FFFFFF'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

export function Logo({ variant, size = 40 }: { variant: LogoVariant; size?: number }) {
  if (variant === 'full' || variant === 'full-dark') {
    const dark = variant === 'full-dark';
    const text = dark ? '#FFFFFF' : '#0F2D5B';
    return (
      <svg
        role="img"
        aria-label="Clanix Agenda"
        height={size}
        width={(size * WORDMARK_WIDTH) / 64}
        viewBox={`0 0 ${WORDMARK_WIDTH} 64`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <Mark variant={variant} />
        <path fill={text} d={WORDMARK_CLANIX} />
        <path fill={dark ? '#93C5FD' : '#3B82F6'} d={WORDMARK_AGENDA} />
      </svg>
    );
  }
  return (
    <svg
      role="img"
      aria-label="Clanix Agenda"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Mark variant={variant} />
    </svg>
  );
}
