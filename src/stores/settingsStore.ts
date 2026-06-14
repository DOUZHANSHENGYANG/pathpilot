import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SettingsState {
  theme: "light" | "dark";
  language: "zh" | "en";
  targetDir: string;
  configDir: string;
  setTheme: (theme: "light" | "dark") => void;
  setLanguage: (language: "zh" | "en") => void;
  setTargetDir: (dir: string) => void;
  setConfigDir: (dir: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "dark",
      language: "zh",
      targetDir: "",
      configDir: "",
      setTheme: (theme) => {
        document.documentElement.setAttribute("data-theme", theme);
        set({ theme });
      },
      setLanguage: (language) => set({ language }),
      setTargetDir: (targetDir) => set({ targetDir }),
      setConfigDir: (configDir) => set({ configDir }),
    }),
    {
      name: "pathpilot-settings",
      // Don't persist these to localStorage — loaded from Rust backend
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
      }),
    }
  )
);
