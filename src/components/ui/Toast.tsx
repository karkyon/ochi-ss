"use client"
// 共通 Toast 通知コンポーネント
import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react"

type ToastType = "success" | "error" | "warning" | "info"
type Toast = { id: string; type: ToastType; message: string; duration?: number }

const ToastContext = createContext<{
  showToast: (message: string, type?: ToastType, duration?: number) => void
}>({ showToast: () => {} })

export function useToast() { return useContext(ToastContext) }

const ICONS: Record<ToastType, string> = {
  success: "✅", error: "❌", warning: "⚠️", info: "ℹ️"
}
const COLORS: Record<ToastType, string> = {
  success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  error:   "bg-red-50 border-red-200 text-red-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  info:    "bg-blue-50 border-blue-200 text-blue-800",
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = "info", duration = 4000) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, type, message, duration }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium pointer-events-auto transition-all animate-in slide-in-from-right ${COLORS[toast.type]}`}
            style={{ maxWidth: "360px" }}>
            <span>{ICONS[toast.type]}</span>
            <span className="flex-1">{toast.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="opacity-50 hover:opacity-100 ml-2 text-lg leading-none">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
