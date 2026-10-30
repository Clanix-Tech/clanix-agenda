import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type NewAppointmentPrefill = { date?: string; startTime?: string };

type Ctx = { open(prefill?: NewAppointmentPrefill): void };

const NewAppointmentContext = createContext<Ctx | null>(null);

export type NewAppointmentProviderProps = {
  children: ReactNode;
  /** A Task 8 liga o formulário real; sem ela, nada é renderizado. */
  renderForm?: (args: { prefill: NewAppointmentPrefill | undefined; close(): void }) => ReactNode;
};

export function NewAppointmentProvider({ children, renderForm }: NewAppointmentProviderProps) {
  const [state, setState] = useState<{ isOpen: boolean; prefill?: NewAppointmentPrefill }>({
    isOpen: false,
  });
  const api = useMemo<Ctx>(() => ({ open: (prefill) => setState({ isOpen: true, prefill }) }), []);
  const close = () => setState({ isOpen: false });

  return (
    <NewAppointmentContext.Provider value={api}>
      {children}
      {state.isOpen && renderForm?.({ prefill: state.prefill, close })}
    </NewAppointmentContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- contexto e hook ficam juntos de propósito
export function useNewAppointment(): Ctx {
  const ctx = useContext(NewAppointmentContext);
  if (!ctx) throw new Error('useNewAppointment precisa estar dentro de <NewAppointmentProvider>.');
  return ctx;
}
