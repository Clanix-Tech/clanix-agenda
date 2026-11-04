import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
        test: {
          name: 'app',
          env: { TZ: 'Europe/Lisbon' },
          // Telas com Radix/vaul ficam lentas quando a máquina está ocupada; 5 s gerava falsos negativos.
          testTimeout: 15_000,
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./src/test-setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
        },
      },
      {
        // Lógica pura das Edge Functions (handler.ts); nunca importa index.ts nem _shared/webpush.ts.
        test: {
          name: 'functions',
          environment: 'node',
          include: ['supabase/functions/**/*.test.ts'],
        },
      },
    ],
  },
});
