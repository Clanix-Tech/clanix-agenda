import { currentOrNextBusinessDay, nextBusinessDays } from './dates.ts';
import { seedAppointment, type TestUser, type UserOptions } from './fixtures.ts';

/** Nome com exatamente 120 caracteres (limite do campo). */
export const LONG_NAME =
  'Maria Eduarda Albuquerque de Vasconcelos Figueiredo Nascimento Bragança Cavalcanti Monteiro Souto Maior de Andrade Leões';
if (LONG_NAME.length !== 120) throw new Error(`LONG_NAME tem ${LONG_NAME.length} caracteres`);

export const REALISTIC_USER: UserOptions = {
  name: 'Ana Paula Ribeiro',
  favorites: [
    { name: 'Corte feminino', duration_minutes: 60 },
    { name: 'Escova', duration_minutes: 45 },
    { name: 'Manicure', duration_minutes: 30 },
    { name: 'Coloração', duration_minutes: 120 },
  ],
};

export type RealisticData = {
  /** Hoje, se for dia útil; senão o próximo dia útil. */
  day: string;
  nextDay: string;
  ids: {
    concluido: string;
    naoCompareceu: string;
    cancelado: string;
    longo: string;
    agendado: string;
  };
};

/** Agenda com vários status, um nome de 120 caracteres, telefone e observações. */
export async function seedRealistic(user: TestUser): Promise<RealisticData> {
  const day = currentOrNextBusinessDay();
  const nextDay = nextBusinessDays(1, undefined, new Date(`${day}T15:00:00Z`))[0]!;
  const concluido = await seedAppointment(user, {
    date: day,
    start: '09:00',
    end: '10:00',
    name: 'Fernanda Lima',
    service: 'Corte feminino',
    status: 'concluido',
  });
  const naoCompareceu = await seedAppointment(user, {
    date: day,
    start: '10:00',
    end: '10:30',
    name: 'Rafael Costa',
    service: 'Manicure',
    status: 'nao_compareceu',
  });
  const cancelado = await seedAppointment(user, {
    date: day,
    start: '11:00',
    end: '11:45',
    name: 'Juliana Alves',
    service: 'Escova',
    status: 'cancelado',
    cancelReason: 'Cliente teve um imprevisto',
  });
  // Nunca "hoje": a visão Dia recolhe os atendimentos de hoje que já terminaram, e o nome
  // longo precisa estar na tela a qualquer hora em que o teste rode.
  const longo = await seedAppointment(user, {
    date: nextDay,
    start: '10:30',
    end: '12:00',
    name: LONG_NAME,
    service: 'Coloração',
  });
  const agendado = await seedAppointment(user, {
    date: day,
    start: '15:30',
    end: '16:30',
    name: 'Patrícia Gomes',
    service: 'Corte feminino',
    phone: '(11) 91234-5678',
    notes: 'Prefere horário com a mesma profissional. Alérgica a amônia.',
  });
  await seedAppointment(user, {
    date: nextDay,
    start: '09:30',
    end: '10:30',
    name: 'Camila Torres',
    service: 'Corte feminino',
  });
  await seedAppointment(user, {
    date: nextDay,
    start: '14:00',
    end: '15:00',
    name: 'Larissa Mendes',
    service: 'Escova',
  });
  return { day, nextDay, ids: { concluido, naoCompareceu, cancelado, longo, agendado } };
}
