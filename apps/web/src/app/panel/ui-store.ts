"use client";

import { create } from "zustand";

type PanelUiState = {
  isCreateMemberModalOpen: boolean;
  openCreateMemberModal: () => void;
  closeCreateMemberModal: () => void;
};

export const usePanelUiStore = create<PanelUiState>((set) => ({
  isCreateMemberModalOpen: false,
  openCreateMemberModal: () => set({ isCreateMemberModalOpen: true }),
  closeCreateMemberModal: () => set({ isCreateMemberModalOpen: false }),
}));
