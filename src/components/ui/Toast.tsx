import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastItem = { id: number; message: string; tone: 'success' | 'error' | 'info' };
type ToastContextValue = { toast: (message: string, tone?: ToastItem['tone']) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((message: string, tone: ToastItem['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4200);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return <ToastContext.Provider value={value}>
    {children}
    <div className="toast-stack" aria-live="polite">
      {items.map((item) => <div className={`toast toast-${item.tone}`} key={item.id}>
        {item.tone === 'success' ? <CheckCircle2 size={18}/> : item.tone === 'error' ? <XCircle size={18}/> : <Info size={18}/>}
        <span>{item.message}</span>
        <button aria-label="Tutup notifikasi" onClick={() => setItems((current) => current.filter((x) => x.id !== item.id))}><X size={15}/></button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
