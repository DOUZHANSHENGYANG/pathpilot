import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Sun, Moon, Globe, FolderOpen } from "lucide-react";
import { cn } from "../lib/utils";
import { useSettingsStore } from "../stores/settingsStore";

interface SettingsBarProps {
  onToast: (message: string, type: "success" | "error" | "info") => void;
  onThemeToggle: (e: React.MouseEvent, newTheme: "light" | "dark") => void;
}

export default function SettingsBar({ onToast, onThemeToggle }: SettingsBarProps) {
  const { t, i18n } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const language = useSettingsStore((s) => s.language);
  const targetDir = useSettingsStore((s) => s.targetDir);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setTargetDir = useSettingsStore((s) => s.setTargetDir);

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

  const handleThemeClick = (e: React.MouseEvent) => {
    const newTheme = theme === "light" ? "dark" : "light";
    onThemeToggle(e, newTheme);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.3 }}
      className="flex items-center justify-between h-11 px-3 bg-base-200/80 backdrop-blur-sm border-t border-base-300/50 shrink-0"
    >
      {/* Target Directory — pill-shaped path display */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleDirSelect}
        className={cn(
          "flex items-center gap-1.5 h-7 px-2.5 rounded-full min-w-0",
          "text-xs text-base-content/60 hover:text-base-content",
          "hover:bg-base-300/80 transition-colors duration-200",
        )}
        title={targetDir || t("settings.targetDirHint")}
      >
        <FolderOpen size={13} className="shrink-0" />
        <span className="truncate">
          {targetDir || t("settings.targetDirHint")}
        </span>
      </motion.button>

      {/* Right Controls Group */}
      <div className="flex items-center gap-1">
        {/* Theme Toggle — pill with icon */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleThemeClick}
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-full",
            "bg-base-300/60 hover:bg-base-300",
            "text-base-content/60 hover:text-base-content",
            "transition-colors duration-200"
          )}
          title={theme === "light" ? t("settings.themeDark") : t("settings.themeLight")}
        >
          <motion.div
            key={theme}
            initial={{ rotate: -180, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            exit={{ rotate: 180, scale: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {theme === "light" ? <Sun size={14} /> : <Moon size={14} />}
          </motion.div>
        </motion.button>

        {/* Divider */}
        <span className="w-px h-4 bg-base-300 mx-0.5" />

        {/* Language Toggle — pill */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleLanguage}
          className={cn(
            "flex items-center gap-1 px-2 h-7 rounded-full",
            "bg-base-300/60 hover:bg-base-300",
            "text-xs font-medium",
            "text-base-content/60 hover:text-base-content",
            "transition-colors duration-200"
          )}
          title={t("settings.language")}
        >
          <Globe size={12} />
          <span>{language === "zh" ? "EN" : "中文"}</span>
        </motion.button>
      </div>
    </motion.div>
  );
}
