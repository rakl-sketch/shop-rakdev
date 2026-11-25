import type { ReactNode } from 'react';
import { PackageOpen } from 'lucide-react';
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><PackageOpen size={24}/></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}
