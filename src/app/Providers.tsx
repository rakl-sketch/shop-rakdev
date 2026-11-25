import type { PropsWithChildren } from 'react';
import { AuthProvider } from './AuthProvider';
import { CartProvider } from './CartProvider';
import { ToastProvider } from '../components/ui/Toast';
import { AnnouncementProvider } from '../features/notifications/AnnouncementProvider';

export function Providers({ children }: PropsWithChildren) {
  return <ToastProvider><AnnouncementProvider><AuthProvider><CartProvider>{children}</CartProvider></AuthProvider></AnnouncementProvider></ToastProvider>;
}
