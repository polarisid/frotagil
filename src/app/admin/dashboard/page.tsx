
'use client'; // Changed to client component to use hooks

import { useEffect } from 'react'; // Import useEffect
import { PageTitle } from '@/components/shared/PageTitle';
import { Container } from '@/components/shared/Container';
import { KPICard } from '@/components/admin/KPICard';
import type { KPI, Vehicle, Maintenance, Incident, Checklist, User } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangleIcon, CalendarClockIcon, WrenchIcon, UsersIcon, ListChecksIcon, TruckIcon, UsersRoundIcon, CheckCircle2Icon, HistoryIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { getVehicles } from '@/lib/services/vehicleService';
import { getMaintenances } from '@/lib/services/maintenanceService';
import { getIncidents } from '@/lib/services/incidentService';
import { getChecklists } from '@/lib/services/checklistService';
import { getUsers } from '@/lib/services/userService';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

export default function AdminDashboardPage() {
   const { currentUser, loading: authLoading } = useAuth();
   const router = useRouter();

  const { data: vehicles, isLoading: vehiclesLoading, error: vehiclesError } = useQuery<Vehicle[], Error>({ queryKey: ['vehicles'], queryFn: getVehicles });
  const { data: maintenances, isLoading: maintenancesLoading, error: maintenancesError } = useQuery<Maintenance[], Error>({ queryKey: ['maintenances'], queryFn: () => getMaintenances() });
  const { data: incidents, isLoading: incidentsLoading, error: incidentsError } = useQuery<Incident[], Error>({ queryKey: ['incidents'], queryFn: () => getIncidents() });
  const { data: checklists, isLoading: checklistsLoading, error: checklistsError } = useQuery<Checklist[], Error>({ queryKey: ['checklists'], queryFn: () => getChecklists() });
  const { data: users, isLoading: usersLoading, error: usersError } = useQuery<User[], Error>({ queryKey: ['users'], queryFn: getUsers });

  useEffect(() => {
    if (!authLoading && (!currentUser || currentUser.role !== 'admin')) {
      router.push('/');
    }
  }, [authLoading, currentUser, router]);


   if (authLoading || vehiclesLoading || maintenancesLoading || incidentsLoading || checklistsLoading || usersLoading) {
     return (
        <Container>
            <PageTitle title="Painel do Administrador" description="Carregando dados..." />
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 xl:grid-cols-4">
                <Skeleton className="lg:col-span-1 h-64 w-full" />
                <Skeleton className="lg:col-span-1 h-64 w-full" />
                <Skeleton className="lg:col-span-1 h-64 w-full" />
                 <Skeleton className="lg:col-span-1 h-64 w-full xl:col-span-1" /> {/* For the 4th column */}
            </div>
        </Container>
     );
   }

   if (!currentUser || currentUser.role !== 'admin') {
    return <Container><p>Acesso não autorizado. Redirecionando...</p></Container>;
  }

  const queryError = vehiclesError || maintenancesError || incidentsError || checklistsError || usersError;
  if(queryError){
    return <Container><PageTitle title="Erro ao carregar dados" description={queryError.message} /></Container>;
  }


  const recentMaintenances = maintenances
    ?.sort((a,b) => {
        const dateA = a.scheduledDate ? new Date(a.scheduledDate + "T00:00:00") : new Date(0);
        const dateB = b.scheduledDate ? new Date(b.scheduledDate + "T00:00:00") : new Date(0);
        return dateB.getTime() - dateA.getTime();
    })
    .slice(0,5) || [];

  const recentIncidents = incidents
    ?.filter(i => i.status !== 'resolved') // Filter out resolved incidents
    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0,5) || [];

  const kpis: KPI[] = [
    { title: 'Total de Veículos', value: vehicles?.length || 0, icon: TruckIcon, bgColorClass: 'bg-blue-100 dark:bg-blue-900/30', href: '/admin/vehicles' },
    { title: 'Em Manutenção', value: vehicles?.filter(v => v.status === 'maintenance').length || 0, icon: WrenchIcon, bgColorClass: 'bg-yellow-100 dark:bg-yellow-900/30', href: '/admin/maintenances?status=in_progress' },
    { title: 'Sinistros Pendentes', value: incidents?.filter(i => i.status === 'under_analysis' || i.status === 'reported').length || 0, icon: AlertTriangleIcon, bgColorClass: 'bg-orange-100 dark:bg-orange-900/30', href: '/admin/incidents?status=pending' },
    { title: 'Checklists Hoje', value: checklists?.filter(c => new Date(c.date).toDateString() === new Date().toDateString()).length || 0, icon: ListChecksIcon, bgColorClass: 'bg-green-100 dark:bg-green-900/30', href: '/admin/checklists?date=today' },
  ];

  const vehiclesInUse = vehicles?.filter(v => v.assignedOperatorId && v.status === 'active') || [];
  const availableVehicles = vehicles?.filter(v => !v.assignedOperatorId && v.status === 'active') || [];

  const getOperatorName = (operatorId?: string | null) => {
    if (!operatorId) return 'N/A';
    return users?.find(u => u.id === operatorId)?.name || 'Desconhecido';
  };


  return (
    <Container>
      <PageTitle title={`Painel do Administrador`} description={`Bem-vindo, ${currentUser.name}! Gerencie sua frota de forma eficiente.`} />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          kpi.href ? (
            <Link href={kpi.href} key={kpi.title} className="no-underline">
              <KPICard kpi={kpi} />
            </Link>
          ) : (
            <KPICard key={kpi.title} kpi={kpi} />
          )
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Card className="lg:col-span-1 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center">
              <WrenchIcon className="mr-2 h-5 w-5 text-primary" />
              Manutenções Recentes
            </CardTitle>
            <CardDescription>Últimas manutenções agendadas ou em progresso.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentMaintenances.length > 0 ? (
              <ScrollArea className="h-[200px] pr-2">
                <ul className="space-y-3">
                  {recentMaintenances.map(maint => {
                    const vehicle = vehicles?.find(v => v.id === maint.vehicleId);
                    const statusMap: Record<Maintenance['status'], string> = { planned: 'Planejada', in_progress: 'Em Progresso', completed: 'Concluída', cancelled: 'Cancelada'};
                    return (
                      <li key={maint.id} className="text-sm p-2 border rounded-md hover:bg-secondary/30">
                        <p className="font-medium">{maint.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {vehicle?.plate} - Status: {statusMap[maint.status] || maint.status}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            ) : <p className="text-sm text-muted-foreground">Nenhuma manutenção recente.</p>}
             <Button asChild variant="link" className="mt-2 px-0 -mb-2">
                <Link href="/admin/maintenances">Ver Todas Manutenções</Link>
             </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangleIcon className="mr-2 h-5 w-5 text-primary" />
              Ocorrências Recentes
            </CardTitle>
             <CardDescription>Últimas ocorrências e sinistros não resolvidos.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentIncidents.length > 0 ? (
              <ScrollArea className="h-[200px] pr-2">
                <ul className="space-y-3">
                  {recentIncidents.map(incident => {
                     const vehicle = vehicles?.find(v => v.id === incident.vehicleId);
                    return(
                      <li key={incident.id} className="text-sm p-2 border rounded-md hover:bg-secondary/30">
                        <p className="font-medium">{incident.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {vehicle?.plate} ({incident.operatorName}) - Data: {new Date(incident.date).toLocaleDateString('pt-BR')}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            ) : <p className="text-sm text-muted-foreground">Nenhuma ocorrência pendente.</p>}
            <Button asChild variant="link" className="mt-2 px-0 -mb-2">
                <Link href="/admin/incidents">Ver Todas Ocorrências</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-1 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center">
              <UsersRoundIcon className="mr-2 h-5 w-5 text-primary" />
              Veículos em Uso ({vehiclesInUse.length})
            </CardTitle>
            <CardDescription>Veículos atualmente com operadores.</CardDescription>
          </CardHeader>
          <CardContent>
            {vehiclesInUse.length > 0 ? (
              <ScrollArea className="h-[200px] pr-2">
                <ul className="space-y-2">
                  {vehiclesInUse.map(v => (
                    <li key={v.id} className="text-sm p-2 border rounded-md">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{v.plate}</span>
                          <span className="text-xs text-muted-foreground ml-1">({v.make} {v.model})</span>
                        </div>
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {getOperatorName(v.assignedOperatorId)}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum veículo em uso no momento.</p>
            )}
             <Button asChild variant="link" className="mt-2 px-0 -mb-2">
                <Link href="/admin/vehicle-usage">Ver Histórico de Uso</Link>
             </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center">
               <CheckCircle2Icon className="mr-2 h-5 w-5 text-primary" />
              Veículos Disponíveis ({availableVehicles.length})
            </CardTitle>
            <CardDescription>Veículos prontos para uso.</CardDescription>
          </CardHeader>
          <CardContent>
            {availableVehicles.length > 0 ? (
              <ScrollArea className="h-[200px] pr-2">
                 <ul className="space-y-2">
                  {availableVehicles.map(v => (
                    <li key={v.id} className="text-sm p-2 border rounded-md flex justify-between items-center">
                      <span className="font-medium">{v.plate}</span>
                      <Badge variant="outline">{v.make} {v.model}</Badge>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            ) : (
               <p className="text-sm text-muted-foreground">Nenhum veículo disponível no momento.</p>
            )}
             <Button asChild variant="link" className="mt-2 px-0 -mb-2">
                <Link href="/admin/vehicles">Gerenciar Veículos</Link>
             </Button>
          </CardContent>
        </Card>

      </div>
       <Card className="mt-6 shadow-md">
            <CardHeader>
                <CardTitle className="flex items-center">
                    <CalendarClockIcon className="mr-2 h-5 w-5 text-primary" />
                    Ações Rápidas
                </CardTitle>
                <CardDescription>Acesse as principais funcionalidades do sistema.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <Button asChild className="w-full justify-start bg-accent hover:bg-accent/90 text-accent-foreground">
                    <Link href="/admin/vehicles/new"><TruckIcon className="mr-2 h-4 w-4" /> Cadastrar Novo Veículo</Link>
                </Button>
                 <Button asChild className="w-full justify-start" variant="outline">
                    <Link href="/admin/checklists"><ListChecksIcon className="mr-2 h-4 w-4" /> Visualizar Checklists</Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                    <Link href="/admin/users"><UsersIcon className="mr-2 h-4 w-4" /> Gerenciar Usuários</Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                    <Link href="/admin/maintenances/new"><WrenchIcon className="mr-2 h-4 w-4" /> Agendar Manutenção</Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                    <Link href="/admin/incidents"><AlertTriangleIcon className="mr-2 h-4 w-4" /> Ver Ocorrências</Link>
                </Button>
                 <Button asChild className="w-full justify-start" variant="outline">
                    <Link href="/admin/vehicle-usage"><HistoryIcon className="mr-2 h-4 w-4" /> Histórico de Uso</Link>
                </Button>
            </CardContent>
        </Card>
    </Container>
  );
}

