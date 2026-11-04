import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateProfile, type Profile } from '@/features/profile/api';
import { FIELD, SaveButton, SectionCard } from './shared';

const BRAZIL_TIMEZONES: Array<[string, string]> = [
  ['America/Sao_Paulo', 'Brasília (São Paulo)'],
  ['America/Manaus', 'Manaus'],
  ['America/Belem', 'Belém'],
  ['America/Fortaleza', 'Fortaleza'],
  ['America/Recife', 'Recife'],
  ['America/Bahia', 'Salvador (Bahia)'],
  ['America/Cuiaba', 'Cuiabá'],
  ['America/Campo_Grande', 'Campo Grande'],
  ['America/Porto_Velho', 'Porto Velho'],
  ['America/Boa_Vista', 'Boa Vista'],
  ['America/Rio_Branco', 'Rio Branco'],
  ['America/Noronha', 'Fernando de Noronha'],
  ['America/Araguaina', 'Araguaína'],
  ['America/Maceio', 'Maceió'],
  ['America/Santarem', 'Santarém'],
];

const NAME_ERROR = 'Informe seu nome (até 80 caracteres).';

type Props = { profile: Profile; onDirtyChange: (dirty: boolean) => void };

export function ProfileSection({ profile, onDirtyChange }: Props) {
  const [saved, setSaved] = useState({
    name: profile.display_name,
    business: profile.business_name ?? '',
    tz: profile.timezone,
  });
  const [name, setName] = useState(saved.name);
  const [business, setBusiness] = useState(saved.business);
  const [tz, setTz] = useState(saved.tz);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const mutation = useUpdateProfile();

  const changed = name !== saved.name || business !== saved.business || tz !== saved.tz;
  // Durante o envio o formulário conta como limpo; se falhar, volta a ser editado.
  const dirty = changed && !submitting;
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current || !changed) return;
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 80) {
      setNameError(NAME_ERROR);
      return;
    }
    setNameError(null);
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const businessName = business.trim();
      await mutation.mutateAsync({
        display_name: trimmed,
        business_name: businessName === '' ? null : businessName,
        ...(tz !== saved.tz ? { timezone: tz } : {}),
      });
      setSaved({ name: trimmed, business: businessName, tz });
      setName(trimmed);
      setBusiness(businessName);
      toast.success('Alterações salvas');
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Algo deu errado. Tente novamente.');
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  const zones = BRAZIL_TIMEZONES.some(([id]) => id === tz)
    ? BRAZIL_TIMEZONES
    : [...BRAZIL_TIMEZONES, [tz, tz] as [string, string]];

  return (
    <SectionCard title="Perfil" description="Como você aparece e em qual fuso a agenda funciona.">
      <form onSubmit={(e) => void submit(e)} noValidate className="flex max-w-md flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="perfil-nome">Seu nome</Label>
          <Input
            id="perfil-nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? 'perfil-nome-erro' : undefined}
            className={FIELD}
          />
          {nameError && (
            <p id="perfil-nome-erro" role="alert" className="text-sm text-[#B91C1C]">
              {nameError}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="perfil-negocio">Nome do estabelecimento (opcional)</Label>
          <Input
            id="perfil-negocio"
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            maxLength={80}
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="perfil-fuso">Fuso horário</Label>
          <select
            id="perfil-fuso"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            className={FIELD}
          >
            {zones.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-[#B91C1C]">
            {error} Seus dados continuam aqui; toque em Salvar para tentar novamente.
          </p>
        )}
        <div>
          <SaveButton pending={mutation.isPending} label="Salvar perfil" disabled={!changed} />
        </div>
      </form>
    </SectionCard>
  );
}
