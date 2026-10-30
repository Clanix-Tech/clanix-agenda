export const apptKeys = {
  all: ['appointments'] as const,
  range: (fromIso: string, toIso: string) => ['appointments', 'range', fromIso, toIso] as const,
  detail: (id: string) => ['appointments', 'detail', id] as const,
  history: (id: string) => ['appointments', 'history', id] as const,
  search: (params: unknown) => ['appointments', 'search', params] as const,
};
