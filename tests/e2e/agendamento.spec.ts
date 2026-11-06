import { admin, detailsSheet, expect, login, mainNav, test } from './support/fixtures.ts';
import { TZ, dateBR, dayChip, nextBusinessDays, toInstant } from './support/dates.ts';

const CLIENT = 'Joana Prado';

test('novo agendamento com favorito → Agenda e Início → concluir, editar, remarcar, cancelar e reativar', async ({
  page,
  makeUser,
}) => {
  const user = await makeUser({
    favorites: [
      { name: 'Corte feminino', duration_minutes: 45 },
      { name: 'Escova', duration_minutes: 30 },
    ],
  });
  const [day, otherDay] = nextBusinessDays(2) as [string, string];

  await login(page, user);
  await expect(
    page.getByText('Sua agenda está livre. Que tal marcar o primeiro atendimento?'),
  ).toBeVisible();

  // Novo agendamento pelo "+" da navegação, com serviço favorito.
  await mainNav(page).getByRole('button', { name: 'Novo agendamento' }).click();
  const form = page.getByRole('dialog', { name: 'Novo agendamento' });
  await form.getByLabel('Nome do cliente').fill(CLIENT);
  const service = form.getByLabel('Serviço', { exact: true });
  await service.selectOption({ label: 'Corte feminino · 45 min' });
  await expect(service.locator('option:checked')).toHaveText('Corte feminino · 45 min');
  await form.getByLabel('Data', { exact: true }).fill(day);
  await form.getByLabel('Início', { exact: true }).fill('14:00');
  await expect(form.getByLabel('Duração')).toHaveValue('45');
  await expect(form.locator('output')).toHaveText('14:45');
  await expect(form.getByText('Horário livre, dentro do expediente')).toBeVisible();
  await form.getByRole('button', { name: 'Salvar agendamento' }).click();
  await expect(page.getByText('Agendamento salvo')).toBeVisible();
  await expect(form).toBeHidden();

  // Aparece na Agenda (dia), no horário digitado (fuso do perfil, mesmo com navegador em Lisboa).
  await mainNav(page).getByRole('link', { name: 'Agenda' }).click();
  await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
  await page.goto(`/agenda?visao=dia&data=${day}`);
  const card = page.getByRole('button', { name: new RegExp(`^14:00 14:45 ${CLIENT}`) });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Corte feminino');

  // E no Início como próximo atendimento.
  await mainNav(page).getByRole('link', { name: 'Início' }).click();
  const next = page.getByRole('region', { name: 'Próximo atendimento' });
  await expect(next).toContainText(CLIENT);
  await next.getByRole('button', { name: 'Ver detalhes' }).click();

  const sheet = detailsSheet(page);
  await expect(sheet).toContainText('14:00 – 14:45 · 45 min');
  await expect(sheet).toContainText(dateBR(day));

  // Concluir.
  await sheet.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByText('Status atualizado')).toBeVisible();
  await expect(sheet.getByText('Concluído', { exact: true }).first()).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Voltar para agendado' })).toBeVisible();

  // Editar dados.
  await sheet.getByRole('button', { name: 'Editar dados' }).click();
  const edit = page.getByRole('dialog', { name: 'Editar agendamento' });
  await edit.getByLabel('Telefone').fill('(11) 98888-7777');
  await edit.getByLabel('Observações').fill('Prefere água sem gás');
  await edit.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(edit).toBeHidden();
  await expect(sheet).toContainText('Prefere água sem gás');
  await expect(sheet).toContainText('(11) 98888-7777');
  await expect(sheet.getByText('Dados editados')).toBeVisible();

  // Só agendados podem ser remarcados: volta para agendado e remarca para outro dia.
  await sheet.getByRole('button', { name: 'Voltar para agendado' }).click();
  await expect(sheet.getByRole('button', { name: 'Remarcar' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Remarcar' }).click();
  await expect(page.getByRole('heading', { name: 'Remarcar atendimento' })).toBeVisible();
  await page.getByRole('button', { name: dayChip(otherDay), exact: true }).click();
  await page.getByRole('button', { name: '10:00', exact: true }).click();
  await expect(page.getByText(`→ ${dateBR(otherDay).slice(0, 5)} às 10:00`)).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar remarcação' }).click();
  await expect(page.getByText('Atendimento remarcado')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/agenda\\?visao=dia&data=${otherDay}$`));

  const moved = page.getByRole('button', { name: new RegExp(`^10:00 10:45 ${CLIENT}`) });
  await expect(moved).toBeVisible();

  // Cancelar com motivo.
  await moved.click();
  await expect(sheet).toContainText('10:00 – 10:45');
  await expect(sheet.getByText(/^Remarcado de /)).toBeVisible();
  await sheet.getByRole('button', { name: 'Cancelar atendimento' }).click();
  const cancel = page.getByRole('dialog', { name: 'Cancelar este atendimento?' });
  await cancel.getByLabel('Motivo (opcional)').fill('Cliente viajou');
  await cancel.getByRole('button', { name: 'Cancelar atendimento' }).click();
  await expect(page.getByText('Atendimento cancelado')).toBeVisible();
  await expect(cancel).toBeHidden();
  await expect(sheet.getByText('Cancelado', { exact: true }).first()).toBeVisible();
  await expect(sheet.getByText('Motivo: Cliente viajou')).toBeVisible();

  // Reativar.
  await sheet.getByRole('button', { name: 'Reativar' }).click();
  const confirm = page.getByRole('dialog', { name: 'Reativar este atendimento?' });
  await confirm.getByRole('button', { name: 'Reativar' }).click();
  await expect(page.getByText('Atendimento reativado')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Remarcar' })).toBeVisible();
  await expect(sheet.getByText('Agendado', { exact: true }).first()).toBeVisible();

  // O banco confirma: um único registro, agendado, no novo horário de São Paulo.
  const { data, error } = await admin()
    .from('appointments')
    .select('status, starts_at, ends_at, client_phone, notes, service_name')
    .eq('owner_id', user.id);
  expect(error).toBeNull();
  expect(data).toHaveLength(1);
  const row = data![0]!;
  expect(row.status).toBe('agendado');
  expect(Date.parse(row.starts_at)).toBe(Date.parse(toInstant(otherDay, '10:00', TZ)));
  expect(Date.parse(row.ends_at)).toBe(Date.parse(toInstant(otherDay, '10:45', TZ)));
  expect(row).toMatchObject({
    client_phone: '(11) 98888-7777',
    notes: 'Prefere água sem gás',
    service_name: 'Corte feminino',
  });
});
