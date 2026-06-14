import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "./stores/settingsStore";
import CustomTitlebar from "./components/CustomTitlebar";
import PathInput from "./components/PathInput";
import ActionBar from "./components/ActionBar";
import SettingsBar from "./components/SettingsBar";
import ToastContainer from "./components/ToastContainer";
import { useToast } from "./hooks/useToast";
import i18n from "./i18n";

export interface PathInfo {
  original: string;
  expanded: string;
  exists: boolean;
  is_file: boolean;
  is_dir: boolean;
  parent_dir: string;
}

function App() {
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const language = useSettingsStore((s) => s.language);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setTargetDir = useSettingsStore((s) => s.setTargetDir);
  const { toasts, addToast, removeToast } = useToast();
  const [pathInfo, setPathInfo] = useState<PathInfo | null>(null);
  const [sourcePath, setSourcePath] = useState("");

  // Load settings from Rust backend on startup
  useEffect(() => {
    invoke<{ theme: string; language: string; target_dir: string }>("load_settings")
      .then((settings) => {
        if (settings.theme) {
          setTheme(settings.theme as "light" | "dark");
          document.documentElement.setAttribute("data-theme", settings.theme);
        }
        if (settings.language) {
          i18n.changeLanguage(settings.language);
        }
        if (settings.target_dir) {
          setTargetDir(settings.target_dir);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language]);

  // Theme toggle using View Transition API — true circular reveal.
  // The browser captures old & new snapshots, then we animate the
  // new snapshot's clip-path from a point to full screen.
  const handleThemeToggle = useCallback(
    (e: React.MouseEvent, newTheme: "light" | "dark") => {
      const x = e.clientX;
      const y = e.clientY;
      // Calculate radius that covers the entire viewport from click point
      const r = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );
      document.documentElement.style.setProperty("--vt-x", `${x}px`);
      document.documentElement.style.setProperty("--vt-y", `${y}px`);
      document.documentElement.style.setProperty("--vt-r", `${r}px`);

      // Check for View Transition API support
      if ("startViewTransition" in document) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (document as any).startViewTransition(() => {
          setTheme(newTheme);
          invoke("save_settings", {
            settings: { theme: newTheme, language, target_dir: useSettingsStore.getState().targetDir },
          }).catch(console.error);
        });
      } else {
        // Fallback: instant switch
        setTheme(newTheme);
        invoke("save_settings", {
          settings: { theme: newTheme, language, target_dir: useSettingsStore.getState().targetDir },
        }).catch(console.error);
      }
    },
    [language]
  );

  return (
    <div className="flex flex-col h-screen bg-base-100 text-base-content overflow-hidden">
      {/* Custom Titlebar */}
      <CustomTitlebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 pb-4">
        <AnimatePresence mode="wait">
          <motion.div
            key="main-panel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-xl flex flex-col gap-5"
          >
            {/* App Header */}
            <div className="text-center mb-2">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="text-sm text-base-content/60 font-medium tracking-wide"
              >
                {t("app.subtitle")}
              </motion.p>
            </div>

            {/* Path Input */}
            <PathInput
              onPathParsed={(info, source) => {
                setPathInfo(info);
                setSourcePath(source);
              }}
              onError={(msg) => addToast(msg, "error")}
            />

            {/* Action Buttons */}
            <ActionBar
              pathInfo={pathInfo}
              sourcePath={sourcePath}
              onToast={addToast}
            />

            {/* Status Display */}
            <AnimatePresence>
              {pathInfo && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center justify-center gap-2 text-sm"
                >
                  {!pathInfo.exists ? (
                    <span className="text-error flex items-center gap-1.5">
                      <span className="i-lucide-alert-circle w-4 h-4" />
                      {t("status.notFound")}
                    </span>
                  ) : pathInfo.is_file ? (
                    <span className="text-success flex items-center gap-1.5">
                      <span className="i-lucide-file w-4 h-4" />
                      {t("status.file")}: {pathInfo.expanded}
                    </span>
                  ) : (
                    <span className="text-info flex items-center gap-1.5">
                      <span className="i-lucide-folder w-4 h-4" />
                      {t("status.directory")}: {pathInfo.expanded}
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Settings Bar */}
      <SettingsBar onToast={addToast} onThemeToggle={handleThemeToggle} />

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
