import horizontalClaro from '@/assets/brand/clanix-agenda-horizontal-claro.svg';
import horizontalEscuro from '@/assets/brand/clanix-agenda-horizontal-escuro.svg';
import icone from '@/assets/brand/clanix-agenda-icone.svg';
import { useTheme } from '@/lib/theme';

export interface LogoProps {
  variant: 'horizontal' | 'icone';
  /** Altura em px. */
  size?: number;
  /** `sobre-escuro`: sempre a versão para fundo escuro, qualquer que seja o tema. */
  tone?: 'auto' | 'sobre-escuro';
}

export function Logo({ variant, size = 40, tone = 'auto' }: LogoProps) {
  const { resolved } = useTheme();
  const src =
    variant === 'icone'
      ? icone
      : tone === 'sobre-escuro' || resolved === 'dark'
        ? horizontalEscuro
        : horizontalClaro;
  return (
    <img
      src={src}
      alt="Clanix Agenda"
      height={size}
      className="w-auto object-contain object-left"
      style={{ height: size }}
    />
  );
}
