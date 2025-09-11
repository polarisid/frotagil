
'use client';

import Link from 'next/link';
import { LogOutIcon, UserCircleIcon, SettingsIcon, TruckIcon, ListChecksIcon, LayoutDashboardIcon, WrenchIcon, UsersIcon, AlertTriangle as AlertTriangleIconLucide, HistoryIcon, BarChart3Icon, ChevronDownIcon, CarIcon, ClipboardCheckIcon, ShieldAlertIcon, CalendarClockIcon, ReceiptTextIcon, ConstructionIcon } from 'lucide-react';
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

interface SubNavItem extends NavItem {}

interface MainNavItem {
  label: string;
  icon: React.ElementType;
  href?: string; // For direct links
  subItems?: SubNavItem[]; // For dropdowns
}

const operatorNavItems: NavItem[] = [
  { href: '/operator/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/operator/checklists', label: 'Meus Checklists', icon: ListChecksIcon },
  { href: '/operator/fines', label: 'Minhas Multas', icon: ReceiptTextIcon },
  { href: '/operator/workshop', label: 'Oficina', icon: ConstructionIcon },
];

const adminNavItems: MainNavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
  { 
    label: 'Frota', 
    icon: TruckIcon, 
    subItems: [
      { href: '/admin/vehicles', label: 'Gerenciar Veículos', icon: CarIcon },
      { href: '/admin/checklists', label: 'Checklists de Veículos', icon: ClipboardCheckIcon },
      { href: '/admin/maintenances', label: 'Manutenções', icon: WrenchIcon },
      { href: '/admin/incidents', label: 'Ocorrências', icon: ShieldAlertIcon },
      { href: '/admin/fines', label: 'Multas', icon: ReceiptTextIcon },
      { href: '/admin/vehicle-usage', label: 'Histórico de Uso', icon: CalendarClockIcon },
    ]
  },
  { href: '/admin/workshop', label: 'Oficina', icon: ConstructionIcon },
  { href: '/admin/users', label: 'Usuários', icon: UsersIcon },
  { href: '/admin/reports', label: 'Relatórios', icon: BarChart3Icon },
];


export function Header({ userRole }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout, loading } = useAuth();
  
  const currentNavItems = userRole === 'operator' ? operatorNavItems : adminNavItems;

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
          <div className="flex items-center gap-2">
            <TruckIcon className="h-7 w-7 text-primary animate-pulse" />
            <span className="text-xl font-bold text-primary">FrotaÁgil</span>
          </div>
          <div className="h-6 w-24 animate-pulse rounded-md bg-muted"></div>
        </div>
      </header>
    );
  }

  const isSubItemActive = (subItems?: SubNavItem[]) => {
    return subItems?.some(subItem => pathname === subItem.href || pathname.startsWith(subItem.href + '/'));
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={userRole === 'operator' ? '/operator/dashboard' : '/admin/dashboard'} className="flex items-center gap-2">
          <TruckIcon className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold text-primary">FrotaÁgil</span>
        </Link>
        
        <nav className="hidden items-center space-x-1 md:flex">
          {currentNavItems.map((item) => {
            if ('subItems' in item && item.subItems) {
              return (
                <DropdownMenu key={item.label}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "px-3 py-2 text-sm font-medium flex items-center",
                        isSubItemActive(item.subItems) ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {item.label}
                      <ChevronDownIcon className="ml-1 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {item.subItems.map(subItem => (
                      <DropdownMenuItem key={subItem.href} asChild className={cn(pathname === subItem.href || pathname.startsWith(subItem.href + '/') ? "bg-accent/50" : "")}>
                        <Link href={subItem.href}>
                          <subItem.icon className="mr-2 h-4 w-4" />
                          {subItem.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }
            // Direct link item
            return (
              <Button
                key={item.href}
                variant="ghost"
                asChild
                className={cn(
                  "px-3 py-2 text-sm font-medium",
                  (item.href && (pathname === item.href || pathname.startsWith(item.href + '/'))) ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Link href={item.href!}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            );
          })}
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
          
          {/* Mobile Menu Trigger (Hamburger) */}
          <div className="md:hidden">
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <MenuIcon className="h-6 w-6" />
                        <span className="sr-only">Abrir menu</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Navegação</DropdownMenuLabel>
                    <DropdownMenuSeparator/>
                    {currentNavItems.map(navItem => {
                        if ('subItems' in navItem && navItem.subItems) {
                            return navItem.subItems.map(sub => (
                                <DropdownMenuItem key={sub.href} asChild className={cn(pathname === sub.href || pathname.startsWith(sub.href + '/') ? "bg-accent/50" : "")}>
                                    <Link href={sub.href}>
                                        <sub.icon className="mr-2 h-4 w-4" />
                                        {sub.label}
                                    </Link>
                                </DropdownMenuItem>
                            ));
                        }
                        return (
                            <DropdownMenuItem key={navItem.href} asChild className={cn(navItem.href && (pathname === navItem.href || pathname.startsWith(navItem.href + '/')) ? "bg-accent/50" : "")}>
                                <Link href={navItem.href!}>
                                    <navItem.icon className="mr-2 h-4 w-4" />
                                    {navItem.label}
                                </Link>
                            </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuContent>
             </DropdownMenu>
          </div>

        </div>
      </div>
    </header>
  );
}

// Placeholder for MenuIcon if not already imported
const MenuIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </svg>
);

interface HeaderProps {
  userRole: 'operator' | 'admin';
}
