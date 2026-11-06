import { useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import {
  useDeleteFavorite,
  useFavorites,
  useSaveFavorite,
  type FavoriteService,
} from '@/features/favorites/api';
import { FAVORITE_COLORS, colorLabel } from '@/features/favorites/colors';
import { FIELD, PRIMARY_BTN, SectionCard } from './shared';

const DUPLICATE = 'Você já tem um serviço com esse nome.';

type Editing = FavoriteService | 'new' | null;

export function FavoritesSection() {
  const favorites = useFavorites(true);
  const del = useDeleteFavorite();
  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<FavoriteService | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const removeBusy = useRef(false);

  if (favorites.isPending) return <LoadingState label="Carregando serviços…" />;
  if (favorites.isError) {
    return (
      <ErrorState
        message="Não foi possível carregar os serviços."
        onRetry={() => void favorites.refetch()}
      />
    );
  }

  const active = favorites.data.filter((f) => f.is_active);
  const inactive = favorites.data.filter((f) => !f.is_active);

  const confirmRemove = async () => {
    if (!removing || removeBusy.current) return;
    removeBusy.current = true;
    setRemoveError(null);
    try {
      await del.mutateAsync({ id: removing.id });
      setRemoving(null);
      toast.success('Serviço removido');
    } catch (err) {
      setRemoveError((err as { message?: string }).message ?? 'Algo deu errado.');
    } finally {
      removeBusy.current = false;
    }
  };

  const row = (f: FavoriteService) => {
    const label = colorLabel(f.color);
    return (
      <li
        key={f.id}
        className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-card p-3"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{f.name}</p>
          <p className="flex items-center gap-2 text-sm text-foreground-secondary">
            <span>{f.duration_minutes} min</span>
            {label && f.color && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-3 rounded-full"
                  style={{ backgroundColor: f.color }}
                />
                {label}
              </span>
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          aria-label={`Editar ${f.name}`}
          onClick={() => setEditing(f)}
        >
          Editar
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 text-error"
          aria-label={`Remover ${f.name}`}
          onClick={() => {
            setRemoveError(null);
            setRemoving(f);
          }}
        >
          Remover
        </Button>
      </li>
    );
  };

  return (
    <SectionCard
      title="Serviços favoritos"
      description="Atalhos para escolher o serviço e a duração ao agendar."
    >
      <div className="flex flex-col gap-4">
        <div>
          <Button type="button" className={PRIMARY_BTN} onClick={() => setEditing('new')}>
            Adicionar serviço
          </Button>
        </div>
        {favorites.data.length === 0 && (
          <p className="text-muted-foreground">Você ainda não tem serviços favoritos.</p>
        )}
        {active.length > 0 && (
          <ul aria-label="Serviços ativos" className="flex flex-col gap-2">
            {active.map(row)}
          </ul>
        )}
        {inactive.length > 0 && (
          <>
            <h3 className="font-display text-base font-semibold text-foreground-secondary">
              Inativos
            </h3>
            <ul aria-label="Serviços inativos" className="flex flex-col gap-2">
              {inactive.map(row)}
            </ul>
          </>
        )}
      </div>

      {editing && (
        <FavoriteDialog
          key={editing === 'new' ? 'new' : editing.id}
          favorite={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover serviço?</DialogTitle>
            <DialogDescription>
              {removing ? `“${removing.name}” sai da lista de favoritos. ` : ''}Os atendimentos já
              agendados não mudam.
            </DialogDescription>
          </DialogHeader>
          {removeError && (
            <p role="alert" className="text-sm text-error">
              {removeError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setRemoving(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={del.isPending}
              variant="destructive"
              className="h-11"
              onClick={() => void confirmRemove()}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

function FavoriteDialog({
  favorite,
  onClose,
}: {
  favorite: FavoriteService | null;
  onClose: () => void;
}) {
  const save = useSaveFavorite();
  const [name, setName] = useState(favorite?.name ?? '');
  const [duration, setDuration] = useState(String(favorite?.duration_minutes ?? 30));
  const [color, setColor] = useState<string | null>(favorite?.color ?? null);
  const [active, setActive] = useState(favorite?.is_active ?? true);
  const [errors, setErrors] = useState<{ name?: string; duration?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current) return;
    const trimmed = name.trim();
    const n = Number(duration);
    const next: typeof errors = {};
    if (trimmed.length < 1 || trimmed.length > 80) next.name = 'Informe o nome do serviço.';
    if (duration.trim() === '' || !Number.isInteger(n) || n < 5 || n > 480) {
      next.duration = 'Informe de 5 a 480 minutos.';
    }
    setErrors(next);
    if (next.name || next.duration) return;
    busy.current = true;
    setError(null);
    try {
      await save.mutateAsync({
        id: favorite?.id,
        name: trimmed,
        duration_minutes: n,
        color,
        is_active: active,
      });
      toast.success('Alterações salvas');
      onClose();
    } catch (err) {
      const kind = (err as { kind?: string }).kind;
      if (kind === 'duplicado') setErrors({ name: DUPLICATE });
      else setError((err as { message?: string }).message ?? 'Algo deu errado. Tente novamente.');
    } finally {
      busy.current = false;
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{favorite ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
          <DialogDescription>Nome, duração e uma cor opcional para reconhecer.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fav-nome">Nome do serviço</Label>
            <Input
              id="fav-nome"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((er) => ({ ...er, name: undefined }));
              }}
              maxLength={80}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'fav-nome-erro' : undefined}
              className={FIELD}
            />
            {errors.name && (
              <p id="fav-nome-erro" role="alert" className="text-sm text-error">
                {errors.name}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fav-duracao">Duração (minutos)</Label>
            <Input
              id="fav-duracao"
              type="number"
              inputMode="numeric"
              min={5}
              max={480}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              aria-invalid={errors.duration ? true : undefined}
              className={`${FIELD} max-w-40`}
            />
            {errors.duration && (
              <p role="alert" className="text-sm text-error">
                {errors.duration}
              </p>
            )}
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-foreground">Cor</legend>
            <div className="flex flex-wrap gap-2">
              {[{ hex: null, label: 'Sem cor' }, ...FAVORITE_COLORS].map((c) => (
                <label
                  key={c.label}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-input bg-card px-3 text-[15px] text-foreground-secondary has-[:checked]:border-ring has-[:checked]:bg-secondary has-[:checked]:font-bold has-[:checked]:text-secondary-foreground has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring"
                >
                  <input
                    type="radio"
                    name="fav-cor"
                    checked={color === c.hex}
                    onChange={() => setColor(c.hex)}
                    className="sr-only"
                  />
                  {c.hex && (
                    <span
                      aria-hidden="true"
                      className="size-3 rounded-full"
                      style={{ backgroundColor: c.hex }}
                    />
                  )}
                  {c.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
            <span className="text-[15px] font-medium text-foreground">Serviço ativo</span>
            <Switch checked={active} onCheckedChange={setActive} aria-label="Serviço ativo" />
          </label>
          {error && (
            <p role="alert" className="text-sm font-medium text-error">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending} className={PRIMARY_BTN}>
              {save.isPending ? 'Salvando…' : 'Salvar serviço'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
