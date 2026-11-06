import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * No celular, a gaveta ocupa a tela inteira (formulários longos: mais fácil para quem não está
   * acostumado). Respeita as áreas do relógio e da barra de gestos. No computador não muda nada.
   */
  fullScreen?: boolean;
};

// Tela cheia: sem margem no topo, altura da tela visível (dvh acompanha o teclado no Android),
// sem cantos arredondados e com espaço para o relógio/entalhe do celular.
const FULL_SCREEN =
  'data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:h-dvh data-[vaul-drawer-direction=bottom]:max-h-dvh data-[vaul-drawer-direction=bottom]:rounded-t-none data-[vaul-drawer-direction=bottom]:border-t-0 pt-[env(safe-area-inset-top)]';

/** Gaveta (vaul) abaixo de 1024 px; janela de diálogo acima. Foco preso e Esc fecha em ambos. */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
  fullScreen = false,
}: Props) {
  const desktop = useMediaQuery(DESKTOP_QUERY);

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* Sem descrição: repetir o título fazia o leitor de tela anunciá-lo duas vezes. */}
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          className="max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <DialogClose
            aria-label="Fechar"
            className="absolute top-4 right-4 grid size-11 place-items-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="size-5" />
          </DialogClose>
          {children}
          {footer && <DialogFooter>{footer}</DialogFooter>}
        </DialogContent>
      </Dialog>
    );
  }

  // `handleOnly`: arrastar o conteúdo para baixo rola o formulário em vez de fechar a gaveta (antes,
  // conferir o nome digitado com o conteúdo no topo fechava tudo e perdia o que foi digitado).
  // Fechar continua possível pela alça, tocando fora da gaveta ou com Esc.
  return (
    <Drawer open={open} onOpenChange={onOpenChange} handleOnly>
      <DrawerContent
        aria-describedby={undefined}
        data-full-screen={fullScreen || undefined}
        className={fullScreen ? FULL_SCREEN : undefined}
      >
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className={cn('overflow-y-auto px-4 pb-4', fullScreen && 'min-h-0 flex-1')}>
          {children}
        </div>
        {footer && (
          <DrawerFooter
            className={fullScreen ? 'pb-[calc(1rem+env(safe-area-inset-bottom))]' : undefined}
          >
            {footer}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
