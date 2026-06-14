import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Sun, Moon, Globe, FolderOpen } from "lucide-react";
import { cn } from "../lib/utils";
import { useSettingsStore } from "../stores/settingsStore";

interface SettingsBarProps {
  onToast: (message: string, type: "success" | "error" | "info") => void;
}

export default function SettingsBar({ onToast }: SettingsBarProps) {
  const { t, i18n } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const language = useSettingsStore((s) => s.language);
  const targetDir = useSettingsStore((s) => s.targetDir);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setTargetDir = useSettingsStore((s) => s.setTargetDir);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    invoke("save_settings", {
      settings: { theme: newTheme, language, target_dir: targetDir },
    }).catch(console.error);
  };

  const toggleLanguage = () => {
    const newLang = language === "zh" ? "en" : "zh";
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
    invoke("save_settings", {
      settings: { theme, language: newLang, target_dir: targetDir },
    }).catch(console.error);
  };

  const handleDirSelect = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: t("settings.targetDir"),
      });
      if (selected && typeof selected === "string") {
        setTargetDir(selected);
        invoke("save_settings", {
          settings: { theme, language, target_dir: selected },
        }).catch(console.error);
        onToast(t("toast.settingsSaved"), "success");
      }
    } catch (err) {
      console.error("dir select error:", err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.3 }}
      className="flex items-center justify-between h-10 px-4 bg-base-200 border-t border-base-300 shrink-0"
    >
      {/* Target Directory */}
      <button
        onClick={handleDirSelect}
        className="flex items-center gap-1.5 text-xs text-base-content/60 hover:text-base-content transition-colors duration-150"
        title={targetDir || t("settings.targetDirHint")}
      >
        <FolderOpen size={14} />
        <span className="max-w-[280px] truncate" title={targetDir}>
          {targetDir || t("settings.targetDirHint")}
        </span>
      </button>

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs",
          "hover:bg-base-300 transition-colors duration-150",
          "text-base-content/60 hover:text-base-content"
        )}
        title={theme === "light" ? t("settings.themeDark") : t("settings.themeLight")}
      >
        <motion.div
          key={theme}
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {theme === "light" ? <Sun size={14} /> : <Moon size={14} />}
        </motion.div>
        <span>{t("settings.theme")}</span>
      </button>

      {/* Language Toggle */}
      <button
        onClick={toggleLanguage}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs",
          "hover:bg-base-300 transition-colors duration-150",
          "text-base-content/60 hover:text-base-content"
        )}
        title={t("settings.language")}
      >
        <Globe size={14} />
        <span>{language === "zh" ? "EN" : "中文"}</span>
      </button>
    </motion.div>
  );
}
