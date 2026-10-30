import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#F8FAFC] p-8 text-center">
      <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
        <rect x="6" y="6" width="120" height="120" rx="32" fill="#E7F1FF" />
        <rect
          x="30"
          y="38"
          width="72"
          height="62"
          rx="12"
          fill="#fff"
          stroke="#0F2D5B"
          strokeWidth="4"
        />
        <rect x="44" y="28" width="7" height="18" rx="3.5" fill="#0F2D5B" />
        <rect x="81" y="28" width="7" height="18" rx="3.5" fill="#0F2D5B" />
        <path
          d="M57 64a9 9 0 1 1 13 8c-3 1.6-4 3.3-4 6"
          fill="none"
          stroke="#3B82F6"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle cx="66" cy="88" r="3.6" fill="#3B82F6" />
      </svg>
      <div>
        <p className="mb-1.5 font-[Manrope,sans-serif] text-sm font-bold tracking-[.06em] text-[#1D4ED8]">
          ERRO 404
        </p>
        <h1 className="font-[Manrope,sans-serif] text-[26px] font-extrabold text-[#0F2D5B]">
          Página não encontrada
        </h1>
        <p className="mt-2.5 text-[15px] leading-normal text-[#475569]">
          O endereço pode ter mudado ou não existe mais. Sua agenda continua segura.
        </p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-2.5">
        <Link
          to="/"
          className="flex h-[52px] items-center justify-center rounded-[14px] bg-[#2563EB] text-base font-bold text-white no-underline hover:bg-[#1D4ED8] hover:text-white"
        >
          Ir para o início
        </Link>
        <Link
          to="/agenda"
          className="flex h-12 items-center justify-center rounded-[14px] border border-[#E2E8F0] bg-white text-[15px] font-semibold text-[#0F2D5B] no-underline"
        >
          Abrir agenda
        </Link>
      </div>
    </main>
  );
}
