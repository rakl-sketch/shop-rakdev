import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { LoaderCircle } from 'lucide-react';

type Props = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'light'; loading?: boolean; full?: boolean }>;
export function Button({ children, variant = 'primary', loading = false, full = false, className = '', disabled, ...props }: Props) {
  return <button className={`button button-${variant} ${full ? 'button-full' : ''} ${className}`} disabled={disabled || loading} aria-busy={loading} {...props}>
    {loading && <LoaderCircle className="spin" size={16}/>} {children}
  </button>;
}
