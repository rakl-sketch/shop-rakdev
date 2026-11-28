import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastItem = { id: number; message: string; tone: 'success' | 'error' | 'info' };
type ToastContextValue = { toast: (message: string, tone?: ToastItem['tone']) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Record<number, number>>({});

  const clearTimer = useCallback((id: number) => {
    if (timers.current[id]) {
      window.clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const removeItem = useCallback((id: number) => {
    clearTimer(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, [clearTimer]);

  const startTimer = useCallback((id: number) => {
    clearTimer(id);
    timers.current[id] = window.setTimeout(() => removeItem(id), 4200);
  }, [clearTimer, removeItem]);

  const toast = useCallback((message: string, tone: ToastItem['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, message, tone }]);
  }, []);

  useEffect(() => {
    items.forEach((item) => {
      if (!timers.current[item.id]) startTimer(item.id);
    });
  }, [items, startTimer]);

  useEffect(() => () => {
    Object.keys(timers.current).forEach((key) => window.clearTimeout(timers.current[Number(key)]));
    timers.current = {};
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);
  return <ToastContext.Provider value={value}>
    {children}
    <div className="toast-stack" aria-live="polite">
      {items.map((item) => <div
        className={`toast toast-${item.tone}`}
        key={item.id}
        role={item.tone === 'error' ? 'alert' : 'status'}
        aria-atomic="true"
        onMouseEnter={() => clearTimer(item.id)}
        onMouseLeave={() => startTimer(item.id)}
        onFocus={() => clearTimer(item.id)}
        onBlur={() => startTimer(item.id)}
      >
        {item.tone === 'success' ? <CheckCircle2 size={17}/> : item.tone === 'error' ? <XCircle size={17}/> : <Info size={17}/>}
        <span>{item.message}</span>
        <button aria-label="Tutup notifikasi" onClick={() => removeItem(item.id)}><X size={15}/></button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}