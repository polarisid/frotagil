import { Header } from '@/components/shared/Header';
import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header userRole="admin" />
      <main className="flex-grow">{children}</main>
       <footer className="py-4 text-center text-sm text-muted-foreground border-t">
         FrotaÁgil © {new Date().getFullYear()} - Projetado por Daniel Carvalho
      </footer>
    </div>
  );
}
