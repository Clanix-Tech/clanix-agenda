// Cria (ou recria) uma conta de teste com expediente, serviços favoritos e atendimentos
// fictícios no Supabase LOCAL, para testar o app à mão. Uso: npm run dados:teste
// Só roda contra 127.0.0.1/localhost: recusa qualquer outra URL. Nunca use em produção.
// Os atendimentos passam pelas RPCs reais (create_appointment, set_appointment_status,
// cancel_appointment), então valem as mesmas regras de expediente, conflito e histórico.
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const EMAIL = 'teste@clanix.local';
const SENHA = 'clanix-teste-123';
const FUSO_OFFSET = '-03:00'; // America/Sao_Paulo (sem horário de verão desde 2019)

// Cores = FAVORITE_COLORS de src/features/favorites/colors.ts (este script não importa TS: mantenha iguais).
const SERVICOS = [
  { name: 'Corte feminino', duration_minutes: 60, color: '#7C3AED' },
  { name: 'Escova', duration_minutes: 45, color: '#2563EB' },
  { name: 'Manicure', duration_minutes: 45, color: '#DB2777' },
  { name: 'Coloração', duration_minutes: 120, color: '#B45309' },
  { name: 'Design de sobrancelha', duration_minutes: 30, color: '#16A34A' },
];

const CLIENTES = [
  ['Ana Teste', '(11) 90000-0001'],
  ['Bruna Teste', '(11) 90000-0002'],
  ['Carla Teste', null],
  ['Daniela Teste', '(11) 90000-0004'],
  ['Elisa Teste', '(11) 90000-0005'],
  ['Fernanda Teste', null],
  ['Gabriela Teste', '(11) 90000-0007'],
  ['Helena Teste', '(11) 90000-0008'],
];

// Horários por dia (início local, índice do serviço). Todos cabem no expediente abaixo.
const MODELOS_DIA = [
  [
    ['09:00', 0],
    ['10:30', 1],
    ['14:00', 3],
    ['16:30', 2],
  ],
  [
    ['09:30', 4],
    ['11:00', 0],
    ['15:00', 2],
  ],
  [
    ['10:00', 1],
    ['13:30', 0],
    ['17:00', 4],
  ],
];
const MODELO_SABADO = [
  ['09:00', 0],
  ['11:00', 2],
];

function statusLocal() {
  const raw = execSync('npx supabase status -o json', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
}

/** Data local (AAAA-MM-DD) de hoje + `dias`, no fuso de São Paulo. */
function dataLocal(dias) {
  const agoraSp = new Date(Date.now() - 3 * 60 * 60 * 1000);
  agoraSp.setUTCDate(agoraSp.getUTCDate() + dias);
  return agoraSp.toISOString().slice(0, 10);
}

function diaDaSemana(data) {
  return new Date(`${data}T12:00:00Z`).getUTCDay();
}

function somaMinutos(hhmm, minutos) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutos;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function falhar(etapa, error) {
  throw new Error(`${etapa}: ${error.code ?? ''} ${error.message}`);
}

async function main() {
  const status = statusLocal();
  const apiUrl = status.API_URL;
  const host = new URL(apiUrl).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`Recusado: ${apiUrl} não é o Supabase local.`);
  }
  const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(apiUrl, status.SECRET_KEY ?? status.SERVICE_ROLE_KEY, opcoes);

  // Recria a conta do zero (a exclusão apaga perfil, expediente e atendimentos em cascata).
  const { data: lista, error: erroLista } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (erroLista) falhar('Listar usuários', erroLista);
  const antigo = lista.users.find((u) => u.email === EMAIL);
  if (antigo) {
    const { error } = await admin.auth.admin.deleteUser(antigo.id);
    if (error) falhar('Apagar conta antiga', error);
  }
  const { error: erroCriar } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: SENHA,
    email_confirm: true,
    user_metadata: { display_name: 'Profissional Teste' },
  });
  if (erroCriar) falhar('Criar conta', erroCriar);

  const db = createClient(apiUrl, status.PUBLISHABLE_KEY ?? status.ANON_KEY, opcoes);
  const { data: sessao, error: erroLogin } = await db.auth.signInWithPassword({
    email: EMAIL,
    password: SENHA,
  });
  if (erroLogin) falhar('Entrar', erroLogin);
  const userId = sessao.user.id;

  const { error: erroPerfil } = await db
    .from('profiles')
    .update({ business_name: 'Studio Teste', timezone: 'America/Sao_Paulo' })
    .eq('id', userId);
  if (erroPerfil) falhar('Atualizar perfil', erroPerfil);

  const turnos = [];
  for (let dia = 1; dia <= 5; dia++) {
    turnos.push({ weekday: dia, start_time: '09:00', end_time: '12:00' });
    turnos.push({ weekday: dia, start_time: '13:00', end_time: '19:00' });
  }
  turnos.push({ weekday: 6, start_time: '09:00', end_time: '14:00' });
  const { error: erroExpediente } = await db.rpc('set_business_hours', { p_shifts: turnos });
  if (erroExpediente) falhar('Expediente', erroExpediente);

  const { error: erroServicos } = await db.from('favorite_services').insert(SERVICOS);
  if (erroServicos) falhar('Serviços favoritos', erroServicos);

  let criados = 0;
  let cliente = 0;
  const agora = Date.now();
  for (let dias = -10; dias <= 14; dias++) {
    const data = dataLocal(dias);
    const semana = diaDaSemana(data);
    if (semana === 0) continue; // domingo sem expediente
    const modelo = semana === 6 ? MODELO_SABADO : MODELOS_DIA[(dias + 30) % MODELOS_DIA.length];

    for (const [inicio, servico] of modelo) {
      const { name, duration_minutes } = SERVICOS[servico];
      const startsAt = `${data}T${inicio}:00${FUSO_OFFSET}`;
      const endsAt = `${data}T${somaMinutos(inicio, duration_minutes)}:00${FUSO_OFFSET}`;
      const passado = new Date(startsAt).getTime() < agora;
      const [nome, telefone] = CLIENTES[cliente++ % CLIENTES.length];

      const { data: id, error } = await db.rpc('create_appointment', {
        p_client_name: nome,
        p_service_name: name,
        p_starts_at: startsAt,
        p_ends_at: endsAt,
        p_client_phone: telefone,
        p_notes: cliente % 5 === 0 ? 'Observação de teste.' : null,
        p_confirm_past: passado,
      });
      if (error) falhar(`Atendimento ${startsAt}`, error);
      criados++;
      const appointmentId = typeof id === 'string' ? id : id?.id;

      // Passado: a maioria concluída, alguns faltaram. Futuro: alguns cancelados.
      if (passado) {
        const novoStatus = cliente % 7 === 0 ? 'nao_compareceu' : 'concluido';
        const { error: e } = await db.rpc('set_appointment_status', {
          p_id: appointmentId,
          p_status: novoStatus,
        });
        if (e) falhar(`Status ${startsAt}`, e);
      } else if (cliente % 9 === 0) {
        const { error: e } = await db.rpc('cancel_appointment', {
          p_id: appointmentId,
          p_reason: 'Cancelado para teste.',
        });
        if (e) falhar(`Cancelar ${startsAt}`, e);
      }
    }
  }

  await db.auth.signOut();
  console.log(`Conta de teste pronta: ${EMAIL} / ${SENHA}`);
  console.log(`${criados} atendimentos criados (10 dias atrás até 14 dias à frente).`);
}

main().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
