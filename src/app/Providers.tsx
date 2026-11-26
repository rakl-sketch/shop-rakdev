import type { PropsWithChildren } from 'react';
import { AuthProvider } from './AuthProvider';
import { CartProvider } from './CartProvider';
import { ToastProvider } from '../components/ui/Toast';
import { NotificationsProvider } from '../features/notifications/NotificationsProvider';

export function Providers({ children }: PropsWithChildren) {
  return <ToastProvider>
    <AuthProvider>
      <NotificationsProvider>
        <CartProvider>{children}</CartProvider>
      </NotificationsProvider>
    </AuthProvider>
  </ToastProvider>;
}
