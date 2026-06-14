import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Copy, Scissors, FolderOpen, FolderSearch, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { useSettingsStore } from "../stores/settingsStore";
import type { PathInfo } from "../App";

interface ActionBarProps {
  pathInfo: PathInfo | null;
  sourcePath: string;
  onToast: (message: string, type: "success" | "error" | "info") => void;
}

export default function ActionBar({ pathInfo, sourcePath, onToast }: ActionBarProps) {
  const { t } = useTranslation();
  const targetDir = useSettingsStore((s) => s.targetDir);
  const [copying, setCopying] = useState(false);
  const [moving, setMoving] = useState(false);

  const disabled = !pathInfo || !pathInfo.exists || !sourcePath.trim();

  const getExpandedPath = (): string => {
    return pathInfo?.expanded || sourcePath;
  };

  const handleCopy = async () => {
    if (disabled) return;
    const src = getExpandedPath();
    const dest = targetDir || await getDefaultTarget();
    setCopying(true);
    try {
      const result = await invoke<string>("copy_to_target", { source: src, targetDir: dest });
      if (result.startsWith("__CANCELLED__")) return; // User cancelled, no toast
      onToast(t("toast.copySuccess"), "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onToast(`${t("toast.copyFailed")}: ${msg}`, "error");
    } finally {
      setCopying(false);
    }
  };

  const handleMove = async () => {
    if (disabled) return;
    const src = getExpandedPath();
    const dest = targetDir || await getDefaultTarget();
    setMoving(true);
    try {
      const result = await invoke<string>("move_to_target", { source: src, targetDir: dest });
      if (result.startsWith("__CANCELLED__")) return; // User cancelled, no toast
      onToast(t("toast.moveSuccess"), "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onToast(`${t("toast.moveFailed")}: ${msg}`, "error");
    } finally {
      setMoving(false);
    }
  };

  const handleOpenSource = async () => {
    if (disabled) return;
    const isFile = pathInfo?.is_file ?? false;
    // File → open parent directory; Directory → open itself
    const openPath = isFile
      ? (pathInfo?.parent_dir || "")
      : getExpandedPath();
    try {
      await invoke("open_in_explorer", { path: openPath });
      onToast(t("toast.openedSource"), "info");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onToast(msg, "error");
    }
  };

  const handleOpenTarget = async () => {
    const dest = targetDir || await getDefaultTarget();
    try {
      await invoke("open_in_explorer", { path: dest });
      onToast(t("toast.openedTarget"), "info");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onToast(msg, "error");
    }
  };

  const getDefaultTarget = async (): Promise<string> => {
    try {
      const settings = await invoke<{ target_dir: string }>("load_settings");
      return settings.target_dir;
    } catch {
      return "";
    }
  };

  const buttonVariants = {
    rest: { scale: 1 },
    hover: { scale: 1.03 },
    tap: { scale: 0.97 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.3 }}
      className="flex items-center gap-2"
    >
      {/* Copy */}
      <motion.button
        variants={buttonVariants}
        initial="rest"
        whileHover={disabled ? "rest" : "hover"}
        whileTap={disabled ? "rest" : "tap"}
        onClick={handleCopy}
        disabled={disabled || copying}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 h-11 rounded-xl",
          "bg-primary text-primary-content font-medium text-sm",
          "shadow-sm hover:shadow-md transition-shadow duration-200",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        )}
      >
        {copying ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Copy size={16} />
        )}
        {t("actions.copy")}
      </motion.button>

      {/* Move */}
      <motion.button
        variants={buttonVariants}
        initial="rest"
        whileHover={disabled ? "rest" : "hover"}
        whileTap={disabled ? "rest" : "tap"}
        onClick={handleMove}
        disabled={disabled || moving}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 h-11 rounded-xl",
          "bg-warning text-warning-content font-medium text-sm",
          "shadow-sm hover:shadow-md transition-shadow duration-200",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        )}
      >
        {moving ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Scissors size={16} />
        )}
        {t("actions.move")}
      </motion.button>

      {/* Open Source */}
      <motion.button
        variants={buttonVariants}
        initial="rest"
        whileHover={disabled ? "rest" : "hover"}
        whileTap={disabled ? "rest" : "tap"}
        onClick={handleOpenSource}
        disabled={disabled}
        className={cn(
          "flex items-center justify-center gap-1.5 h-11 px-3 rounded-xl",
          "bg-base-200 hover:bg-base-300 text-base-content/70 hover:text-base-content",
          "font-medium text-sm transition-colors duration-150",
          "disabled:opacity-40 disabled:cursor-not-allowed"
        )}
        title={t("actions.openSource")}
      >
        <FolderOpen size={16} />
        <span className="hidden sm:inline">{t("actions.openSource")}</span>
      </motion.button>

      {/* Open Target */}
      <motion.button
        variants={buttonVariants}
        initial="rest"
        whileHover="hover"
        whileTap="tap"
        onClick={handleOpenTarget}
        className={cn(
          "flex items-center justify-center gap-1.5 h-11 px-3 rounded-xl",
          "bg-base-200 hover:bg-base-300 text-base-content/70 hover:text-base-content",
          "font-medium text-sm transition-colors duration-150"
        )}
        title={t("actions.openTarget")}
      >
        <FolderSearch size={16} />
        <span className="hidden sm:inline">{t("actions.openTarget")}</span>
      </motion.button>
    </motion.div>
  );
}
