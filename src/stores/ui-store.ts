import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DashboardView = "mom" | "qoq" | "ytd";
export type ChatSize = "sm" | "md" | "full";

interface UiState {
  /** Mobile/tablet: overlay sidebar open. */
  sidebarOpen: boolean;
  /** Desktop: sidebar collapsed to icons (MOM G2). */
  sidebarCollapsed: boolean;
  dashboardView: DashboardView;
  /** Floating FINLEY chat (MOM I9). */
  chatOpen: boolean;
  chatSize: ChatSize;
  chatPos: { x: number; y: number } | null;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setDashboardView: (view: DashboardView) => void;
  setChatOpen: (open: boolean) => void;
  setChatSize: (size: ChatSize) => void;
  setChatPos: (pos: { x: number; y: number } | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      sidebarCollapsed: false,
      dashboardView: "mom",
      chatOpen: false,
      chatSize: "md",
      chatPos: null,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setDashboardView: (dashboardView) => set({ dashboardView }),
      setChatOpen: (chatOpen) => set({ chatOpen }),
      setChatSize: (chatSize) => set({ chatSize }),
      setChatPos: (chatPos) => set({ chatPos }),
    }),
    {
      name: "iod-ui",
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        chatSize: s.chatSize,
        chatPos: s.chatPos,
        dashboardView: s.dashboardView,
      }),
    },
  ),
);
