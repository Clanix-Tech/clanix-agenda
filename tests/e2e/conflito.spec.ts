import {
  admin,
  countAppointments,
  expect,
  login,
  mainNav,
  seedAppointment,
  test,
} from './support/fixtures.ts';
import { TZ, nextBusinessDays, toInstant } from './support/dates.ts';

test('horário ocupado mostra o conflito e uma sugestão livre salva', async ({ page, makeUser }) => {
  const user = await makeUser();
  const [day] = nextBusinessDays(1) as [string];
  await seedAppointment(user, { date: day, start: '14:00', end: '15:00', name: 'Carla Souza' });

  await login(page, user);
  await mainNav(page).getByRole('button', { name: 'Novo agendamento' }).click();
  const form = page.getByRole('dialog', { name: 'Novo agendamento' });
  await form.getByLabel('Nome do cliente').fill('Diego Lima');
  // Sem favoritos, o serviço é texto livre.
  await form.getByLabel('Nome do serviço').fill('Barba');
  await form.getByLabel('Data', { exact: true }).fill(day);
  await form.getByLabel('Início', { exact: true }).fill('14:30');

  const panel = form.getByRole('status').filter({ hasText: 'Esse horário já está ocupado' });
  await expect(panel).toContainText('14:30–15:30 conflita com Carla Souza (14:00–15:00)');
  await expect(form.getByLabel('Início', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(form.getByRole('button', { name: 'Salvar agendamento' })).toBeDisabled();

  // Até 3 horários livres mais próximos (expediente 09–12/13–18, grade de 30 min, 1 hora).
  const free = form.getByRole('region', { name: /^Livres em / }).getByRole('button');
  await expect(free).toHaveText(['13:00 – 14:00', '15:00 – 16:00', '15:30 – 16:30']);
  await free.filter({ hasText: '15:00 – 16:00' }).click();

  await expect(form.getByLabel('Início', { exact: true })).toHaveValue('15:00');
  await expect(panel).toBeHidden();
  await expect(form.getByText('Horário livre, dentro do expediente')).toBeVisible();
  await form.getByRole('button', { name: 'Salvar agendamento' }).click();
  await expect(page.getByText('Agendamento salvo')).toBeVisible();
  await expect(form).toBeHidden();

  expect(await countAppointments(user.id)).toBe(2);
  const { data } = await admin()
    .from('appointments')
    .select('starts_at, ends_at')
    .eq('owner_id', user.id)
    .eq('client_name', 'Diego Lima')
    .single();
  expect(Date.parse(data!.starts_at)).toBe(Date.parse(toInstant(day, '15:00', TZ)));
  expect(Date.parse(data!.ends_at)).toBe(Date.parse(toInstant(day, '16:00', TZ)));
});
