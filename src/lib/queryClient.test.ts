import { onlineManager } from '@tanstack/react-query';
import { createQueryClient } from './queryClient';

describe('createQueryClient', () => {
  afterEach(() => onlineManager.setOnline(true));

  it('sem internet a mutação é tentada e falha (não fica pausada esperando a conexão)', async () => {
    const qc = createQueryClient({ current: () => {} });
    onlineManager.setOnline(false);
    const mutationFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const mutation = qc.getMutationCache().build(qc, { mutationFn });
    await expect(mutation.execute(undefined)).rejects.toThrow('Failed to fetch');
    expect(mutationFn).toHaveBeenCalledTimes(1);
    expect(mutation.state.isPaused).toBe(false);
  });
});
