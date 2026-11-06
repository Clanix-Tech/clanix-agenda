import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8 text-center">
      <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
        <rect x="6" y="6" width="120" height="120" rx="32" className="fill-secondary" />
        <rect
          x="30"
          y="38"
          width="72"
          height="62"
          rx="12"
          className="fill-card stroke-foreground"
          strokeWidth="4"
        />
        <rect x="44" y="28" width="7" height="18" rx="3.5" className="fill-foreground" />
        <rect x="81" y="28" width="7" height="18" rx="3.5" className="fill-foreground" />
        <path
          d="M57 64a9 9 0 1 1 13 8c-3 1.6-4 3.3-4 6"
          fill="none"
          className="stroke-primary"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle cx="66" cy="88" r="3.6" className="fill-primary" />
      </svg>
      <div>
        <p className="mb-1.5 font-display text-sm font-bold tracking-[.06em] text-link">ERRO 404</p>
        <h1 className="font-display text-[26px] font-bold text-foreground">
          Página não encontrada
        </h1>
        <p className="mt-2.5 text-[15px] leading-normal text-foreground-secondary">
          O endereço pode ter mudado ou não existe mais. Sua agenda continua segura.
        </p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-2.5">
        <Link
          to="/"
          className="flex h-[52px] items-center justify-center rounded-control bg-primary text-base font-bold text-primary-foreground no-underline hover:bg-primary-hover hover:text-primary-foreground"
        >
          Ir para o início
        </Link>
        <Link
          to="/agenda"
          className="flex h-12 items-center justify-center rounded-control border border-border bg-card text-[15px] font-semibold text-foreground no-underline"
        >
          Abrir agenda
        </Link>
      </div>
    </main>
  );
}
