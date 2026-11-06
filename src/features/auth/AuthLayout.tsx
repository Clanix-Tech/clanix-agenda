import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { CalendarCheck, Eye, EyeOff, RefreshCw, BellRing } from 'lucide-react';
import type { FieldError } from 'react-hook-form';
import { Logo } from '@/components/brand/Logo';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BENEFITS = [
  { icon: RefreshCw, text: 'Sua agenda no celular e no computador, sempre sincronizada.' },
  { icon: CalendarCheck, text: 'Nunca dois clientes no mesmo horário.' },
  { icon: BellRing, text: 'Lembrete antes de cada atendimento.' },
];

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <aside className="bg-gradient-hero px-6 py-6 text-hero-foreground lg:flex lg:w-[44%] lg:max-w-[640px] lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <Logo variant="horizontal" tone="sobre-escuro" size={44} />
        <div className="mt-4 lg:mt-0">
          <p className="font-display text-xl font-extrabold lg:text-4xl lg:leading-tight">
            Tudo organizado em um só lugar.
          </p>
          <ul className="mt-8 hidden space-y-5 lg:block">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-start gap-3.5 text-base leading-snug text-hero-secondary"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-hero-foreground/10 text-hero-secondary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="pt-2">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="flex flex-1 items-center justify-center px-4 py-8 lg:px-12">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-extrabold text-foreground">{title}</h1>
          {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-error-surface px-3 py-2 text-sm text-error">
      {children}
    </p>
  );
}

export function TextField({
  label,
  error,
  children,
}: {
  label: string;
  error?: FieldError;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby'?: string;
  }) => ReactNode;
}) {
  const id = useId();
  const errId = `${id}-erro`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-foreground-secondary">
        {label}
      </Label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': error ? errId : undefined })}
      {error && (
        <p id={errId} className="text-sm text-error">
          {error.message}
        </p>
      )}
    </div>
  );
}

const inputClass = 'h-12 rounded-xl px-3.5 text-base md:text-base';

export function AuthInput(props: React.ComponentProps<'input'>) {
  return <Input {...props} className={inputClass} />;
}

export function PasswordInput(props: React.ComponentProps<'input'>) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={shown ? 'text' : 'password'} className={`${inputClass} pr-12`} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        {shown ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}

export function AuthLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-semibold text-link underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
