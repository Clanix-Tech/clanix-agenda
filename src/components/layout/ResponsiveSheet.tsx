import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
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
};

/** Gaveta (vaul) abaixo de 1024 px; janela de diálogo acima. Foco preso e Esc fecha em ambos. */
export function ResponsiveSheet({ open, onOpenChange, title, children, footer }: Props) {
  const desktop = useMediaQuery(DESKTOP_QUERY);

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-[Manrope,sans-serif] text-[#0F2D5B]">{title}</DialogTitle>
            <DialogDescription className="sr-only">{title}</DialogDescription>
          </DialogHeader>
          <DialogClose
            aria-label="Fechar"
            className="absolute top-4 right-4 grid size-11 place-items-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-[#3B82F6]/50"
          >
            <X aria-hidden="true" className="size-5" />
          </DialogClose>
          {children}
          {footer && <DialogFooter>{footer}</DialogFooter>}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="font-[Manrope,sans-serif] text-[#0F2D5B]">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">{title}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-4">{children}</div>
        {footer && <DrawerFooter>{footer}</DrawerFooter>}
      </DrawerContent>
    </Drawer>
  );
}
