import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export const PRIMARY_BTN = 'h-11 bg-[#2563EB] px-5 font-bold text-white hover:bg-[#1D4ED8]';
export const FIELD =
  'h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-base text-[#0F172A]';

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby="secao-titulo"
      className="flex flex-col gap-5 rounded-2xl border border-[#E2E8F0] bg-white p-5"
    >
      <header>
        <h2 id="secao-titulo" className="font-[Manrope] text-xl font-extrabold text-[#0F2D5B]">
          {title}
        </h2>
        {description && <p className="mt-1 text-[15px] text-[#475569]">{description}</p>}
      </header>
      {children}
    </section>
  );
}

type Option<T> = { value: T; label: string };

/** Grupo de opções (radio nativo) com área de toque de 44 px; a opção marcada tem contorno e fundo. */
export function ChoiceGroup<T extends string | number>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold text-[#0F2D5B]">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={String(o.value)}
            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-4 text-[15px] font-medium text-[#334155] has-[:checked]:border-[#2563EB] has-[:checked]:bg-[#E7F1FF] has-[:checked]:font-bold has-[:checked]:text-[#1D4ED8] has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-[#3B82F6]/50"
          >
            <input
              type="radio"
              name={name}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SaveButton({
  pending,
  label,
  disabled,
}: {
  pending: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Button type="submit" disabled={pending || disabled} className={PRIMARY_BTN}>
      {pending ? 'Salvando…' : label}
    </Button>
  );
}
