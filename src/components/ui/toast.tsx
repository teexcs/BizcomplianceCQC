import * as React from 'react';
import { cn } from '@/lib/utils';

interface ToastProps {
  message: string;
  variant?: 'default' | 'success' | 'error';
  onClose?: () => void;
}

export function Toast({ message, variant = 'default', onClose }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={cn(
      'fixed bottom-4 right-4 z-50 rounded-lg border px-4 py-3 shadow-lg text-sm',
      variant === 'success' && 'bg-green-50 border-green-200 text-green-900',
      variant === 'error' && 'bg-red-50 border-red-200 text-red-900',
      variant === 'default' && 'bg-background border-border text-foreground',
    )}>
      {message}
    </div>
  );
}

interface ToastContextType {
  showToast: (message: string, variant?: ToastProps['variant']) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = React.useState<{ message: string; variant: ToastProps['variant'] } | null>(null);

  const showToast = React.useCallback((message: string, variant?: ToastProps['variant']) => {
    setToast({ message, variant: variant ?? 'default' });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
