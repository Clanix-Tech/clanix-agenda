import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const MAX = 300;

type Props = {
  open: boolean;
  pending: boolean;
  onOpenChange(open: boolean): void;
  onConfirm(reason: string): void;
};

/** Cancelamento com motivo opcional (até 300 caracteres). */
export function CancelDialog({ open, pending, onOpenChange, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const handleOpenChange = (o: boolean) => {
    if (!o) setReason('');
    onOpenChange(o);
  };
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-[Manrope,sans-serif] text-[#0F2D5B]">
            Cancelar este atendimento?
          </DialogTitle>
          <DialogDescription>O horário será liberado na agenda.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cancel-reason">Motivo (opcional)</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            maxLength={MAX}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-right text-xs text-[#64748B]" aria-live="polite">
            {reason.length}/{MAX}
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => handleOpenChange(false)}
          >
            Voltar
          </Button>
          <Button
            type="button"
            disabled={pending}
            className="h-11 bg-[#B91C1C] text-white hover:bg-[#991B1B]"
            onClick={() => onConfirm(reason.trim())}
          >
            Cancelar atendimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
