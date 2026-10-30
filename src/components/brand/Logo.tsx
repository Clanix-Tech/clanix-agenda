export type LogoVariant = 'icon' | 'full' | 'full-dark' | 'mono';

function Mark({ variant }: { variant: LogoVariant }) {
  const mono = variant === 'mono';
  const dark = variant === 'full-dark';
  const tile = mono ? 'currentColor' : dark ? '#FFFFFF' : '#0F2D5B';
  const cal = mono ? 'var(--logo-bg, #FFFFFF)' : dark ? '#0F2D5B' : '#FFFFFF';
  const blue = mono ? 'currentColor' : '#3B82F6';
  const light = mono ? 'currentColor' : '#93C5FD';
  const badge = mono ? 'currentColor' : dark ? '#FFFFFF' : '#0F2D5B';
  const check = mono ? 'var(--logo-bg, #FFFFFF)' : dark ? '#0F2D5B' : '#FFFFFF';
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
        stroke={check}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

export function Logo({ variant, size = 40 }: { variant: LogoVariant; size?: number }) {
  if (variant === 'icon' || variant === 'mono') {
    return (
      <svg
        role="img"
        aria-label="Agenda em Ordem"
        width={size}
        height={size}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
      >
        <Mark variant={variant} />
      </svg>
    );
  }
  const textColor = variant === 'full-dark' ? '#FFFFFF' : '#0F2D5B';
  return (
    <svg
      role="img"
      aria-label="Agenda em Ordem"
      height={size}
      width={size * 4.4}
      viewBox="0 0 282 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Mark variant={variant} />
      <text
        x="78"
        y="41"
        fontFamily="Manrope Variable, Manrope, system-ui, sans-serif"
        fontWeight="800"
        fontSize="26"
        fill={textColor}
      >
        Agenda em Ordem
      </text>
    </svg>
  );
}
