import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";

export default function CustomTitlebar() {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);
  const win = getCurrentWindow();

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await win.isMaximized();
      setIsMaximized(maximized);
    };
    checkMaximized();

    const unlisten = win.onResized(async () => {
      const maximized = await win.isMaximized();
      setIsMaximized(maximized);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = () => win.minimize();
  const handleToggleMaximize = () => win.toggleMaximize();
  const handleClose = () => win.close();

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-9 bg-base-200 border-b border-base-300 shrink-0 select-none"
    >
      {/* Logo + Title */}
      <div className="flex items-center gap-2 pl-3">
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="32" height="32" rx="8" fill="url(#titlebar-grad)" />
            <path
              d="M8 14h6l4-6 4 6h6"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="16" cy="22" r="3" fill="white" />
            <defs>
              <linearGradient id="titlebar-grad" x1="0" y1="0" x2="32" y2="32">
                <stop stopColor="#4F46E5" />
                <stop offset="1" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>
        <motion.span
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="text-sm font-semibold tracking-tight"
        >
          PathPilot
        </motion.span>
      </div>

      {/* Window Controls */}
      <div className="flex h-full">
        <button
          onClick={handleMinimize}
          className={cn(
            "w-11 h-full flex items-center justify-center",
            "hover:bg-base-300 transition-colors duration-150",
            "text-base-content/60 hover:text-base-content"
          )}
          aria-label={t("window.minimize")}
          title={t("window.minimize")}
        >
          <Minus size={14} strokeWidth={2} />
        </button>
        <button
          onClick={handleToggleMaximize}
          className={cn(
            "w-11 h-full flex items-center justify-center",
            "hover:bg-base-300 transition-colors duration-150",
            "text-base-content/60 hover:text-base-content"
          )}
          aria-label={isMaximized ? t("window.restore") : t("window.maximize")}
          title={isMaximized ? t("window.restore") : t("window.maximize")}
        >
          <Square size={12} strokeWidth={2} />
        </button>
        <button
          onClick={handleClose}
          className={cn(
            "w-11 h-full flex items-center justify-center",
            "hover:bg-error hover:text-error-content transition-colors duration-150",
            "text-base-content/60 hover:text-white"
          )}
          aria-label={t("window.close")}
          title={t("window.close")}
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
