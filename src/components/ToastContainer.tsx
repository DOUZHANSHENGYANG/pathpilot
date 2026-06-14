import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Info, X } from "lucide-react";
import { cn } from "../lib/utils";
import type { Toast } from "../hooks/useToast";

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const colorMap = {
  success: "border-success text-success",
  error: "border-error text-error",
  info: "border-info text-info",
};

export default function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-10 right-3 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = iconMap[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 80, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className={cn(
                "pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg",
                "bg-base-200 border-l-2 shadow-lg text-sm min-w-[200px] max-w-[320px]",
                colorMap[toast.type]
              )}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1 truncate">{toast.message}</span>
              <button
                onClick={() => onRemove(toast.id)}
                className="shrink-0 p-0.5 rounded hover:bg-base-300 transition-colors"
              >
                <X size={12} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
