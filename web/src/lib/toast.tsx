import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface ToastItem {
  id: number;
  text: string;
}

interface ToastContextValue {
  show: (text: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const TOAST_DURATION_MS = 2500;

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, text }]);
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), TOAST_DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-24 left-0 right-0 z-50 flex flex-col items-center gap-2 px-margin pointer-events-none">
        {items.map((item) => (
          <div key={item.id} className="bg-inverse-surface text-inverse-on-surface text-body-sm font-body-sm px-space-md py-space-sm rounded-xl shadow-md max-w-full">
            {item.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
