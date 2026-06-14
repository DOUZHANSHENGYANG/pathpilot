import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { FolderOpen, File, Search, X, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import type { PathInfo } from "../App";

interface PathInputProps {
  onPathParsed: (info: PathInfo, source: string) => void;
  onError: (message: string) => void;
}

export default function PathInput({ onPathParsed, onError }: PathInputProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [pathInfo, setPathInfo] = useState<PathInfo | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const parsePath = useCallback(
    async (value: string) => {
      if (!value.trim()) {
        setPathInfo(null);
        return;
      }

      setParsing(true);
      try {
        const result = await invoke<PathInfo>("parse_path", { input: value });
        setPathInfo(result);
        onPathParsed(result, value);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onError(msg || t("toast.parseFailed"));
        setPathInfo(null);
      } finally {
        setParsing(false);
      }
    },
    [onPathParsed, onError, t]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      parsePath(value);
    }, 300);
  };

  const handleClear = () => {
    setInput("");
    setPathInfo(null);
    onPathParsed({ original: "", expanded: "", exists: false, is_file: false, is_dir: false, parent_dir: "" }, "");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      parsePath(input);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const statusIcon = !pathInfo ? (
    <Search size={18} className="text-base-content/40" />
  ) : parsing ? (
    <Loader2 size={18} className="text-primary animate-spin" />
  ) : !pathInfo.exists ? (
    <X size={18} className="text-error" />
  ) : pathInfo.is_file ? (
    <File size={18} className="text-success" />
  ) : (
    <FolderOpen size={18} className="text-info" />
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.3 }}
      className="relative"
    >
      <div className="relative flex items-center">
        {/* Status Icon */}
        <div className="absolute left-3.5 z-10 pointer-events-none">
          {statusIcon}
        </div>

        {/* Input */}
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={t("input.placeholder")}
          spellCheck={false}
          className={cn(
            "w-full h-12 pl-10 pr-10 rounded-xl",
            "bg-base-200 border-2 border-base-300",
            "text-sm font-mono text-base-content",
            "placeholder:text-base-content/30",
            "outline-none transition-all duration-200",
            "focus:border-primary focus:ring-2 focus:ring-primary/20",
            "hover:border-base-content/20"
          )}
        />

        {/* Clear Button */}
        {input && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={handleClear}
            className={cn(
              "absolute right-3 z-10 p-1 rounded-md",
              "text-base-content/30 hover:text-base-content/60",
              "hover:bg-base-300 transition-colors duration-150"
            )}
            aria-label={t("input.clear")}
          >
            <X size={16} />
          </motion.button>
        )}
      </div>

      {/* Focus Glow Border */}
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full bg-gradient-to-r from-primary via-accent to-primary"
        initial={{ width: "0%" }}
        animate={{ width: input ? "100%" : "0%" }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </motion.div>
  );
}
