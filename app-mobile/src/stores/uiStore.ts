// Preferências de tela guardadas neste aparelho (visão do calendário,
// filtros, onboarding). Não vão para o servidor.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { DateKey } from '@/models/types';
import { DEFAULT_FILTERS, type EventFilters } from '@/utils/filters';
import { DEFAULT_TASK_FILTERS, type SmartView, type TaskFilters, type TaskSort } from '@/utils/tasks';

export type CalendarViewMode = 'month' | 'week' | 'day' | 'list' | 'board';

/** Período do Quadro: um dia, a semana ou o mês inteiro, um dia por coluna. */
export type BoardRange = 'day' | 'week' | 'month';

/** Visão da aba Tarefas: uma visão inteligente ou uma lista (`list:<id>`). */
export type TaskViewKey = SmartView | `list:${string}`;

/** Tipos mostrados no calendário. */
export interface CalendarLayers {
  events: boolean;
  tasks: boolean;
  reminders: boolean;
}

interface UiState {
  onboardingDone: boolean;
  viewMode: CalendarViewMode;
  boardRange: BoardRange;
  setBoardRange: (range: BoardRange) => void;
  selectedDate: DateKey | null;
  filters: EventFilters;
  listTab: 'upcoming' | 'past';
  taskView: TaskViewKey;
  taskSort: TaskSort;
  taskFilters: TaskFilters;
  layers: CalendarLayers;
  /** Seções recolhidas na tela Hoje. */
  collapsed: string[];
  /** Dia em que a pessoa tocou "Agora não" na pergunta do dia. */
  planDismissedOn: DateKey | null;
  setPlanDismissedOn: (day: DateKey | null) => void;
  /** Dia em que a pergunta já apareceu nesta sessão (não é guardado: não reabre sozinha em seguida). */
  planShownOn: DateKey | null;
  setPlanShownOn: (day: DateKey) => void;
  setOnboardingDone: () => void;
  setTaskView: (view: TaskViewKey) => void;
  setTaskSort: (sort: TaskSort) => void;
  setTaskFilters: (filters: TaskFilters) => void;
  setLayers: (layers: CalendarLayers) => void;
  toggleCollapsed: (key: string) => void;
  setViewMode: (mode: CalendarViewMode) => void;
  setSelectedDate: (date: DateKey) => void;
  setFilters: (filters: EventFilters) => void;
  setListTab: (tab: 'upcoming' | 'past') => void;
  resetFilters: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      onboardingDone: false,
      viewMode: 'month',
      boardRange: 'week',
      setBoardRange: (boardRange) => set({ boardRange }),
      selectedDate: null,
      filters: DEFAULT_FILTERS,
      listTab: 'upcoming',
      taskView: 'today',
      taskSort: 'due',
      taskFilters: DEFAULT_TASK_FILTERS,
      layers: { events: true, tasks: true, reminders: true },
      collapsed: [],
      planDismissedOn: null,
      setPlanDismissedOn: (planDismissedOn) => set({ planDismissedOn }),
      planShownOn: null,
      setPlanShownOn: (planShownOn) => set({ planShownOn }),
      setOnboardingDone: () => set({ onboardingDone: true }),
      setTaskView: (taskView) => set({ taskView }),
      setTaskSort: (taskSort) => set({ taskSort }),
      setTaskFilters: (taskFilters) => set({ taskFilters }),
      setLayers: (layers) => set({ layers }),
      toggleCollapsed: (key) =>
        set((s) => ({
          collapsed: s.collapsed.includes(key) ? s.collapsed.filter((k) => k !== key) : [...s.collapsed, key],
        })),
      setViewMode: (viewMode) => set({ viewMode }),
      setSelectedDate: (selectedDate) => set({ selectedDate }),
      setFilters: (filters) => set({ filters }),
      setListTab: (listTab) => set({ listTab }),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
    }),
    {
      name: 'ui-preferences-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        onboardingDone: s.onboardingDone,
        viewMode: s.viewMode,
        boardRange: s.boardRange,
        listTab: s.listTab,
        taskView: s.taskView,
        taskSort: s.taskSort,
        layers: s.layers,
        collapsed: s.collapsed,
        planDismissedOn: s.planDismissedOn,
      }),
    },
  ),
);
