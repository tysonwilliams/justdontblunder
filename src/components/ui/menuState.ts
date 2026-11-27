import { create } from 'zustand';

type MenuState = {
  open: boolean;
  openMenu: () => void;
  closeMenu: () => void;
};

export const useMenuStore = create<MenuState>((set) => ({
  open: false,
  openMenu: () => set({ open: true }),
  closeMenu: () => set({ open: false }),
}));
