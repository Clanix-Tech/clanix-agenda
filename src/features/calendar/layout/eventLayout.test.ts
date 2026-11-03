import { layoutDay } from './eventLayout';

describe('layoutDay', () => {
  it('posiciona 14:00–15:00 em 08:00–19:00 a 52 px/h', () => {
    expect(layoutDay([{ id: 'a', start: '14:00', end: '15:00' }], '08:00', '19:00', 52)).toEqual([
      { id: 'a', top: 312, height: 52 },
    ]);
  });

  it('11:30–12:00 mede 26 px', () => {
    const [r] = layoutDay([{ id: 'a', start: '11:30', end: '12:00' }], '08:00', '19:00', 52);
    expect(r).toEqual({ id: 'a', top: 182, height: 26 });
  });

  it('altura mínima de 24 px', () => {
    const [r] = layoutDay([{ id: 'a', start: '09:00', end: '09:15' }], '08:00', '19:00', 52);
    expect(r!.height).toBe(24);
  });
});
