
'use client';

import Link from 'next/link';
import { LogOutIcon, UserCircleIcon, SettingsIcon, TruckIcon, ListChecksIcon, LayoutDashboardIcon, WrenchIcon, UsersIcon, AlertTriangle as AlertTriangleIconLucide, HistoryIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface HeaderProps {
  userRole: 'operator' | 'admin';
}

const operatorNavItems: NavItem[] = [
  { href: '/operator/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/operator/checklists', label: 'Meus Checklists', icon: ListChecksIcon },
];

const adminNavItems: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/admin/vehicles', label: 'Veículos', icon: TruckIcon },
  { href: '/admin/checklists', label: 'Checklists', icon: ListChecksIcon },
  { href: '/admin/maintenances', label: 'Manutenções', icon: WrenchIcon },
  { href: '/admin/incidents', label: 'Ocorrências', icon: AlertTriangleIconLucide },
  { href: '/admin/users', label: 'Usuários', icon: UsersIcon },
  { href: '/admin/vehicle-usage', label: 'Uso de Veículos', icon: HistoryIcon },
];


export function Header({ userRole }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout, loading } = useAuth();
  const navItems = userRole === 'operator' ? operatorNavItems : adminNavItems;

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  if (loading) {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div>Carregando...</div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={userRole === 'operator' ? '/operator/dashboard' : '/admin/dashboard'} className="flex items-center gap-2">
          <TruckIcon className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold text-primary">FrotaÁgil</span>
        </Link>
        
        <nav className="hidden items-center space-x-1 md:flex">
          {navItems.map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              asChild
              className={cn(
                "px-3 py-2 text-sm font-medium",
                pathname === item.href ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Link href={item.href}>
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {currentUser && (
            <span className="hidden text-sm text-muted-foreground md:inline">
              Olá, {currentUser.name} ({userRole === 'operator' ? 'Operador' : 'Admin'})
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <UserCircleIcon className="h-6 w-6" />
                <span className="sr-only">User menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{currentUser?.email || 'Minha Conta'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <SettingsIcon className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOutIcon className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
