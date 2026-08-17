import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LagoonContext, LagoonContextInput } from './types';

function makeId(): string {
  // Not cryptographic — just a stable unique key for the registry.
  return `ctx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface ContextsState {
  contexts: LagoonContext[];
  activeContextId: string | null;
  addContext: (input: LagoonContextInput) => LagoonContext;
  updateContext: (id: string, patch: Partial<Omit<LagoonContext, 'id'>>) => void;
  removeContext: (id: string) => void;
  setActiveContext: (id: string | null) => void;
}

export const useContextsStore = create<ContextsState>()(
  persist(
    (set, get) => ({
      contexts: [],
      activeContextId: null,

      addContext: (input) => {
        const context: LagoonContext = { ...input, id: makeId() };
        set((state) => ({
          contexts: [...state.contexts, context],
          // First context becomes active automatically.
          activeContextId: state.activeContextId ?? context.id,
        }));
        return context;
      },

      updateContext: (id, patch) => {
        set((state) => ({
          contexts: state.contexts.map((c) => (c.id === id ? { ...c, ...patch, id } : c)),
        }));
      },

      removeContext: (id) => {
        set((state) => {
          const contexts = state.contexts.filter((c) => c.id !== id);
          return {
            contexts,
            activeContextId:
              state.activeContextId === id ? (contexts[0]?.id ?? null) : state.activeContextId,
          };
        });
      },

      setActiveContext: (id) => {
        if (id !== null && !get().contexts.some((c) => c.id === id)) return;
        set({ activeContextId: id });
      },
    }),
    {
      name: 'lagoon-contexts',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function useActiveContext(): LagoonContext | null {
  return useContextsStore(
    (state) => state.contexts.find((c) => c.id === state.activeContextId) ?? null,
  );
}
