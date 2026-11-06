import { useTheme, type ThemePreference } from '@/lib/theme';
import { ChoiceGroup, SectionCard } from './shared';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'auto', label: 'Automático' },
  { value: 'claro', label: 'Claro' },
  { value: 'escuro', label: 'Escuro' },
];

export function AppearanceSection() {
  const { preference, setPreference } = useTheme();
  return (
    <SectionCard title="Aparência" description="Vale só para este aparelho.">
      <ChoiceGroup
        legend="Tema"
        name="tema"
        value={preference}
        options={OPTIONS}
        onChange={setPreference}
      />
    </SectionCard>
  );
}
