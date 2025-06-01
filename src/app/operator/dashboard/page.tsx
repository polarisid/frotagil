
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageTitle } from '@/components/shared/PageTitle';
import { Container } from '@/components/shared/Container';
import { VehicleCard } from '@/components/operator/VehicleCard';
import type { Checklist as ChecklistType, Vehicle as VehicleType, Incident, Maintenance, VehicleUsageLog, KPI } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ListChecksIcon, CalendarDaysIcon, TruckIcon, LogInIcon, LogOutIcon, ClipboardListIcon, HistoryIcon, MessageSquareWarningIcon, AlertTriangleIcon, WrenchIcon, Undo2Icon, ActivityIcon, RouteIcon, CalendarRangeIcon, FileTextIcon } from 'lucide-react';
import { ReportIncidentDialog } from '@/components/operator/ReportIncidentDialog';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getVehicles, pickUpVehicle, returnVehicle } from '@/lib/services/vehicleService';
import { getIncidents } from '@/lib/services/incidentService';
import { getMaintenances } from '@/lib/services/maintenanceService';
import { getChecklistsForOperator, getChecklistForCurrentPossession } from '@/lib/services/checklistService';
import { getVehicleUsageLogs } from '@/lib/services/vehicleUsageLogService'; // Import service
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { format, addDays, isPast, isToday, differenceInDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UpdateMileageDialog } from '@/components/operator/UpdateMileageDialog'; 
import { KPICard } from '@/components/admin/KPICard';


export default function OperatorDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [isIncidentAlertOpen, setIsIncidentAlertOpen] = useState(false);
  const [selectedVehicleForAlert, setSelectedVehicleForAlert] = useState<VehicleType | null>(null);
  const [openIncidentsForAlert, setOpenIncidentsForAlert] = useState<Incident[]>([]);

  const [isMaintenanceAlertOpen, setIsMaintenanceAlertOpen] = useState(false);
  const [pendingMaintenancesForAlert, setPendingMaintenancesForAlert] = useState<Maintenance[]>([]);

  const [isUpdateMileageDialogOpen, setIsUpdateMileageDialogOpen] = useState(false);
  const [vehicleToReturn, setVehicleToReturn] = useState<VehicleType | null>(null);


  const { data: vehicles, isLoading: vehiclesLoading, error: vehiclesError } = useQuery<VehicleType[], Error>({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
  });

  const { data: operatorChecklists, isLoading: checklistsLoading, error: checklistsError } = useQuery<ChecklistType[], Error>({
    queryKey: ['operatorChecklists', currentUser?.id],
    queryFn: () => currentUser ? getChecklistsForOperator(currentUser.id) : Promise.resolve([]),
    enabled: !!currentUser,
  });

  const { data: usageLogs, isLoading: usageLogsLoading, error: usageLogsError } = useQuery<VehicleUsageLog[], Error>({
    queryKey: ['operatorUsageLogs', currentUser?.id],
    queryFn: () => currentUser ? getVehicleUsageLogs({ operatorId: currentUser.id, status: 'completed' }) : Promise.resolve([]),
    enabled: !!currentUser,
  });
  
  const { data: incidentsForOperator, isLoading: incidentsLoading, error: incidentsError } = useQuery<Incident[], Error>({
    queryKey: ['operatorIncidents', currentUser?.id],
    queryFn: () => currentUser ? getIncidents({ operatorId: currentUser.id }) : Promise.resolve([]),
    enabled: !!currentUser,
  });


  const currentOperatorPickedUpVehicle = vehicles?.find(
    (v) => v.assignedOperatorId === currentUser?.id && v.status === 'active'
  );

  const { data: checklistForCurrentPossession, isLoading: checklistForPossessionLoading } = useQuery<ChecklistType | null, Error>({
    queryKey: ['checklistForCurrentPossession', currentOperatorPickedUpVehicle?.id, currentUser?.id, currentOperatorPickedUpVehicle?.pickedUpDate],
    queryFn: () => {
      if (!currentOperatorPickedUpVehicle || !currentUser || !currentOperatorPickedUpVehicle.pickedUpDate) {
        return null;
      }
      return getChecklistForCurrentPossession(
        currentOperatorPickedUpVehicle.id,
        currentUser.id,
        currentOperatorPickedUpVehicle.pickedUpDate
      );
    },
    enabled: !!currentOperatorPickedUpVehicle && !!currentUser && !!currentOperatorPickedUpVehicle.pickedUpDate,
  });


  const pickUpMutation = useMutation<void, Error, string>({
    mutationFn: (vehicleId: string) => pickUpVehicle(vehicleId, currentUser!.id),
    onSuccess: (data, vehicleId) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['checklistForCurrentPossession', vehicleId, currentUser!.id] });
      queryClient.invalidateQueries({ queryKey: ['operatorUsageLogs', currentUser?.id] }); 
      const pickedVehicle = vehicles?.find(v => v.id === vehicleId);
      toast({
        title: "Veículo Coletado!",
        description: `Você pegou o veículo ${pickedVehicle?.plate}. Prossiga para o checklist.`,
      });
      router.push(`/operator/checklist/${vehicleId}`);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao coletar veículo",
        description: error.message || "Não foi possível coletar o veículo.",
      });
    },
  });

  const returnMutation = useMutation<void, Error, { vehicleId: string; newMileage: number }>({
    mutationFn: ({ vehicleId, newMileage }) => returnVehicle(vehicleId, currentUser!.id, newMileage),
    onSuccess: (data, { vehicleId, newMileage }) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['checklistForCurrentPossession', vehicleId, currentUser!.id] });
      queryClient.invalidateQueries({ queryKey: ['incidents', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['vehicleUsageLogs']}); 
      queryClient.invalidateQueries({ queryKey: ['operatorUsageLogs', currentUser?.id]}); 
      const returnedVehicle = vehicles?.find(v => v.id === vehicleId);
      toast({
        title: "Veículo Devolvido",
        description: `Veículo ${returnedVehicle?.plate} devolvido com KM ${newMileage.toLocaleString('pt-BR')}.`,
      });
      setIsUpdateMileageDialogOpen(false);
      setVehicleToReturn(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao devolver veículo",
        description: error.message || "Não foi possível devolver o veículo.",
      });
    },
  });

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/');
    }
  }, [authLoading, currentUser, router]);


  const checkAndShowMaintenanceAlert = async (vehicle: VehicleType): Promise<boolean> => {
    try {
      const allMaintenances = await getMaintenances({ vehicleId: vehicle.id });
      
      const relevantMaintenances = allMaintenances.filter(maint => {
        if (maint.status !== 'planned' && maint.status !== 'in_progress') return false;

        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        const oneWeekFromNow = addDays(today, 7);

        let isRelevantByDate = false;
        if (maint.scheduledDate) {
          const scheduledDateObj = new Date(maint.scheduledDate + "T00:00:00"); 
          if (scheduledDateObj <= oneWeekFromNow) { // Vencido ou nos próximos 7 dias
            isRelevantByDate = true;
          }
        }

        let isRelevantByKm = false;
        if (maint.scheduledKm && typeof vehicle.mileage === 'number') {
          if (maint.scheduledKm <= vehicle.mileage + 11000) { // Vencido ou nos próximos 11000km
            isRelevantByKm = true;
          }
        }
        return isRelevantByDate || isRelevantByKm;
      });

      if (relevantMaintenances.length > 0) {
        setPendingMaintenancesForAlert(relevantMaintenances);
        setSelectedVehicleForAlert(vehicle);
        setIsMaintenanceAlertOpen(true);
        return true; 
      }
      return false; 
    } catch (error) {
      console.error("Erro ao buscar ou verificar manutenções:", error);
      toast({
        variant: "destructive",
        title: "Erro ao verificar manutenções",
        description: "Não foi possível verificar as manutenções do veículo.",
      });
      return false;
    }
  };

  const handleAttemptPickUpVehicle = async (vehicle: VehicleType) => {
    if (currentOperatorPickedUpVehicle) {
      toast({
        variant: "destructive",
        title: "Ação não permitida",
        description: `Você já está com o veículo ${currentOperatorPickedUpVehicle.plate}. Devolva-o primeiro.`,
      });
      return;
    }
    setSelectedVehicleForAlert(vehicle); 

    try {
      const incidents = await getIncidents({ vehicleId: vehicle.id });
      const openIncidents = incidents.filter(inc => inc.status === 'reported' || inc.status === 'under_analysis');

      if (openIncidents.length > 0) {
        setOpenIncidentsForAlert(openIncidents);
        setIsIncidentAlertOpen(true);
        return;
      }
    } catch (error) {
      console.error("Erro ao buscar sinistros:", error);
      toast({ variant: "destructive", title: "Erro ao buscar sinistros", description: "Tente novamente." });
      setSelectedVehicleForAlert(null);
      return; 
    }

    const maintenanceAlertOpened = await checkAndShowMaintenanceAlert(vehicle);
    if (!maintenanceAlertOpened) {
      pickUpMutation.mutate(vehicle.id);
      setSelectedVehicleForAlert(null); 
    }
  };

  const confirmPickUpVehicleAfterIncidentOrMaintenance = async () => {
    setIsIncidentAlertOpen(false); 
    
    if (selectedVehicleForAlert) {
      if (isIncidentAlertOpen) { 
        setOpenIncidentsForAlert([]); 
        const maintenanceAlertOpened = await checkAndShowMaintenanceAlert(selectedVehicleForAlert);
        if (!maintenanceAlertOpened) { 
          pickUpMutation.mutate(selectedVehicleForAlert.id);
          setSelectedVehicleForAlert(null);
        }
        return; 
      }

      setIsMaintenanceAlertOpen(false);
      setPendingMaintenancesForAlert([]);
      pickUpMutation.mutate(selectedVehicleForAlert.id);
      setSelectedVehicleForAlert(null);
    }
  };

  const cancelPickUp = () => {
    setIsIncidentAlertOpen(false);
    setIsMaintenanceAlertOpen(false);
    setSelectedVehicleForAlert(null);
    setOpenIncidentsForAlert([]);
    setPendingMaintenancesForAlert([]);
  };

  const handleOpenReturnDialog = (vehicle: VehicleType) => {
    setVehicleToReturn(vehicle);
    setIsUpdateMileageDialogOpen(true);
  };

  const handleConfirmReturnWithMileage = (vehicleId: string, newMileage: number) => {
    returnMutation.mutate({ vehicleId, newMileage });
  };


  if (authLoading || vehiclesLoading || checklistsLoading || usageLogsLoading || incidentsLoading || (!!currentOperatorPickedUpVehicle && checklistForPossessionLoading)) {
    return (
      <Container>
        <PageTitle title="Carregando Dashboard..." />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className="lg:col-span-2 space-y-6">
                 <Skeleton className="h-64 w-full" />
                 <Skeleton className="h-32 w-full" />
                 <Skeleton className="h-40 w-full" /> {/* Placeholder for KPIs */}
            </section>
            <section className="lg:col-span-1">
                <Skeleton className="h-96 w-full" />
            </section>
        </div>
      </Container>
    );
  }

  if (!currentUser) {
    return <Container><p>Redirecionando para login...</p></Container>;
  }

  if (vehiclesError || checklistsError || usageLogsError || incidentsError) {
    return <Container><p>Erro ao carregar dados: {vehiclesError?.message || checklistsError?.message || usageLogsError?.message || incidentsError?.message}</p></Container>;
  }

  const availableVehicles = vehicles?.filter(
    (v) => v.status === 'active' && !v.assignedOperatorId
  ) || [];

  const maintenanceStatusConfig = {
    planned: { label: 'Planejada', className: 'bg-blue-500' },
    in_progress: { label: 'Em Progresso', className: 'bg-yellow-500' },
    completed: { label: 'Concluída', className: 'bg-green-500' },
    cancelled: { label: 'Cancelada', className: 'bg-red-500' },
  };

  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);

  let totalKmDriven = 0;
  let weeklyKmDriven = 0;
  let monthlyKmDriven = 0;
  usageLogs?.forEach(log => {
    if (log.kmDriven && typeof log.kmDriven === 'number') {
      totalKmDriven += log.kmDriven;
      if (log.returnedTimestamp) {
        const returnedDate = new Date(log.returnedTimestamp);
        if (isWithinInterval(returnedDate, { start: currentWeekStart, end: currentWeekEnd })) {
          weeklyKmDriven += log.kmDriven;
        }
        if (isWithinInterval(returnedDate, { start: currentMonthStart, end: currentMonthEnd })) {
          monthlyKmDriven += log.kmDriven;
        }
      }
    }
  });

  const totalChecklists = operatorChecklists?.length || 0;
  const weeklyChecklists = operatorChecklists?.filter(c => isWithinInterval(new Date(c.date), { start: currentWeekStart, end: currentWeekEnd })).length || 0;
  const monthlyChecklists = operatorChecklists?.filter(c => isWithinInterval(new Date(c.date), { start: currentMonthStart, end: currentMonthEnd })).length || 0;

  const totalIncidents = incidentsForOperator?.length || 0;
  const weeklyIncidents = incidentsForOperator?.filter(i => isWithinInterval(new Date(i.date), { start: currentWeekStart, end: currentWeekEnd })).length || 0;
  const monthlyIncidents = incidentsForOperator?.filter(i => isWithinInterval(new Date(i.date), { start: currentMonthStart, end: currentMonthEnd })).length || 0;

  const performanceKpis: KPI[] = [
    { title: 'KM Rodados (Semana)', value: `${weeklyKmDriven.toLocaleString('pt-BR')} km`, icon: CalendarRangeIcon, bgColorClass: 'bg-teal-100 dark:bg-teal-900/30' },
    { title: 'KM Rodados (Mês)', value: `${monthlyKmDriven.toLocaleString('pt-BR')} km`, icon: CalendarDaysIcon, bgColorClass: 'bg-cyan-100 dark:bg-cyan-900/30' },
    { title: 'KM Rodados (Total)', value: `${totalKmDriven.toLocaleString('pt-BR')} km`, icon: RouteIcon, bgColorClass: 'bg-sky-100 dark:bg-sky-900/30' },
    { title: 'Checklists (Semana)', value: weeklyChecklists, icon: ClipboardListIcon, bgColorClass: 'bg-indigo-100 dark:bg-indigo-900/30' },
    { title: 'Checklists (Mês)', value: monthlyChecklists, icon: ClipboardListIcon, bgColorClass: 'bg-purple-100 dark:bg-purple-900/30' },
    { title: 'Checklists (Total)', value: totalChecklists, icon: FileTextIcon, bgColorClass: 'bg-pink-100 dark:bg-pink-900/30' },
    { title: 'Sinistros (Semana)', value: weeklyIncidents, icon: MessageSquareWarningIcon, bgColorClass: 'bg-red-100 dark:bg-red-900/30' },
    { title: 'Sinistros (Mês)', value: monthlyIncidents, icon: MessageSquareWarningIcon, bgColorClass: 'bg-orange-100 dark:bg-orange-900/30' },
    { title: 'Sinistros (Total)', value: totalIncidents, icon: AlertTriangleIcon, bgColorClass: 'bg-yellow-100 dark:bg-yellow-900/30' },
  ];


  return (
    <Container>
      <PageTitle
        title={`Bem-vindo, ${currentUser.name}!`}
        description="Gerencie seu veículo, checklists, ocorrências e acompanhe sua performance."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-6">
          {currentOperatorPickedUpVehicle ? (
            <>
              <div>
                <h2 className="mb-4 text-xl font-semibold text-foreground">Seu Veículo Atual</h2>
                <VehicleCard
                  vehicle={currentOperatorPickedUpVehicle}
                  actionSlot={
                    <div className="flex w-full flex-col gap-2 sm:flex-row">
                      {checklistForCurrentPossession ? (
                        <Button
                          className="flex-1 bg-accent text-accent-foreground opacity-60 cursor-not-allowed"
                          disabled
                        >
                          <ClipboardListIcon className="mr-2 h-4 w-4" />
                          Checklist Desta Posse Concluído
                        </Button>
                      ) : (
                        <Button asChild className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground">
                          <Link href={`/operator/checklist/${currentOperatorPickedUpVehicle.id}`}>
                            <ClipboardListIcon className="mr-2 h-4 w-4" />
                            Preencher Checklist
                          </Link>
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        className="flex-1" 
                        onClick={() => handleOpenReturnDialog(currentOperatorPickedUpVehicle)} 
                        disabled={returnMutation.isPending}
                      >
                        {returnMutation.isPending ? 'Devolvendo...' : (
                          !checklistForCurrentPossession ? (
                            <><Undo2Icon className="mr-2 h-4 w-4" /> Cancelar e Devolver</>
                          ) : (
                            <><LogOutIcon className="mr-2 h-4 w-4" /> Devolver Veículo</>
                          )
                        )}
                      </Button>
                    </div>
                  }
                  operatorName={currentUser.name}
                />
              </div>

              <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <MessageSquareWarningIcon className="mr-2 h-6 w-6 text-primary" />
                        Comunicação de Ocorrências
                    </CardTitle>
                    <CardDescription>
                        Identificou algum problema ou dano no veículo? Registre aqui.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ReportIncidentDialog
                        vehicleId={currentOperatorPickedUpVehicle.id}
                        vehiclePlate={currentOperatorPickedUpVehicle.plate}
                        operatorId={currentUser.id}
                        operatorName={currentUser.name}
                        disabled={!currentOperatorPickedUpVehicle}
                    />
                </CardContent>
              </Card>

            </>
          ) : (
            <>
              <h2 className="mb-4 text-xl font-semibold text-foreground">Veículos Disponíveis para Iniciar Jornada</h2>
              {availableVehicles.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {availableVehicles.map((vehicle) => (
                    <VehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      actionSlot={
                        <Button className="w-full" onClick={() => handleAttemptPickUpVehicle(vehicle)} disabled={pickUpMutation.isPending}>
                          {pickUpMutation.isPending && pickUpMutation.variables === vehicle.id ? 'Coletando...' : <><LogInIcon className="mr-2 h-4 w-4" /> Pegar Veículo e Iniciar Checklist</>}
                        </Button>
                      }
                    />
                  ))}
                </div>
              ) : (
                <Card className="shadow-md">
                  <CardContent className="p-6 text-center">
                    <TruckIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhum veículo disponível no momento.</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center">
                <ActivityIcon className="mr-2 h-6 w-6 text-primary" />
                Minha Performance e Atividade
              </CardTitle>
              <CardDescription>Resumo da sua quilometragem, checklists e ocorrências.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {performanceKpis.map((kpi) => (
                <KPICard key={kpi.title} kpi={kpi} />
              ))}
            </CardContent>
          </Card>
        </section>


        <section className="lg:col-span-1">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center">
                <ListChecksIcon className="mr-2 h-6 w-6 text-primary" />
                Histórico de Checklists
              </CardTitle>
              <CardDescription>Seus checklists mais recentes.</CardDescription>
            </CardHeader>
            <CardContent>
              {operatorChecklists && operatorChecklists.length > 0 ? (
                <ScrollArea className="h-[350px] pr-3">
                  <ul className="space-y-4">
                    {operatorChecklists.slice(0, 5).map((checklist: ChecklistType) => {
                      const vehicle = vehicles?.find(v => v.id === checklist.vehicleId);
                      return (
                        <li key={checklist.id} className="rounded-md border p-3 hover:bg-secondary/50 transition-colors">
                           <div className="flex justify-between items-center">
                            <h3 className="font-medium text-foreground">
                              {vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.plate})` : 'Veículo Desconhecido'}
                            </h3>
                            {checklist.vehicleId && checklist.id ? (
                              <Button variant="ghost" size="sm" asChild>
                                 <Link href={`/operator/checklist/${checklist.vehicleId}?checklistId=${checklist.id}`}>Ver</Link>
                              </Button>
                            ) : null}
                           </div>
                          <p className="text-xs text-muted-foreground flex items-center mt-1">
                            <CalendarDaysIcon className="mr-1 h-3 w-3" />
                            {new Date(checklist.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </p>
                           <p className="text-xs text-muted-foreground mt-1">KM: {checklist.mileage?.toLocaleString('pt-BR') || 'N/A'}</p>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              ) : (
                 <div className="p-6 text-center">
                    <ListChecksIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhum checklist encontrado.</p>
                 </div>
              )}
               {operatorChecklists && operatorChecklists.length > 0 && (
                 <Button asChild variant="outline" className="mt-4 w-full">
                    <Link href="/operator/checklists">
                        <HistoryIcon className="mr-2 h-4 w-4" />
                        Ver Todos os Checklists
                    </Link>
                 </Button>
                )}
            </CardContent>
          </Card>
        </section>
      </div>

      {selectedVehicleForAlert && openIncidentsForAlert.length > 0 && (
        <AlertDialog open={isIncidentAlertOpen} onOpenChange={(open) => !open && cancelPickUp()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center">
                <AlertTriangleIcon className="mr-2 h-6 w-6 text-yellow-500" />
                Atenção: Sinistros em Aberto
              </AlertDialogTitle>
                <AlertDialogDescription>
                    O veículo <span className="font-semibold">{selectedVehicleForAlert.plate}</span> ({selectedVehicleForAlert.make} {selectedVehicleForAlert.model}) possui os seguintes sinistros pendentes:
                </AlertDialogDescription>
                <ScrollArea className="mt-2 h-[150px] rounded-md border p-2">
                    <ul className="space-y-2">
                    {openIncidentsForAlert.map(incident => (
                        <li key={incident.id} className="text-xs">
                        <div className="font-medium">{new Date(incident.date).toLocaleDateString('pt-BR')}: {incident.description.substring(0, 100)}...</div>
                        <Badge variant={incident.status === 'reported' ? 'destructive' : 'default'} className="mt-1 capitalize text-xs">
                            {incident.status.replace('_', ' ')}
                        </Badge>
                        </li>
                    ))}
                    </ul>
                </ScrollArea>
                <p className="text-sm text-muted-foreground pt-2">
                    Deseja pegar este veículo mesmo assim?
                </p>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelPickUp}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmPickUpVehicleAfterIncidentOrMaintenance} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                Pegar Mesmo Assim
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {selectedVehicleForAlert && pendingMaintenancesForAlert.length > 0 && (
         <AlertDialog open={isMaintenanceAlertOpen} onOpenChange={(open) => !open && cancelPickUp()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center">
                <WrenchIcon className="mr-2 h-6 w-6 text-orange-500" />
                Atenção: Manutenções Pendentes/Vencidas
              </AlertDialogTitle>
                O veículo <span className="font-semibold">{selectedVehicleForAlert.plate}</span> ({selectedVehicleForAlert.make} {selectedVehicleForAlert.model}) possui as seguintes manutenções que requerem atenção:
                <ScrollArea className="mt-2 h-[150px] rounded-md border p-2">
                  <ul className="space-y-2">
                    {pendingMaintenancesForAlert.map(maint => {
                       const statusInfo = maintenanceStatusConfig[maint.status] || { label: maint.status, className: 'bg-gray-400'};
                       const today = new Date(); today.setHours(0,0,0,0);
                       const oneWeekFromNow = addDays(today, 7); 
                       let detailParts: React.ReactNode[] = [];

                       if (maint.scheduledDate) {
                           const scheduledDateObj = new Date(maint.scheduledDate + "T00:00:00");
                           const diffDays = differenceInDays(scheduledDateObj, today);
                           if (isPast(scheduledDateObj) && !isToday(scheduledDateObj)) {
                               detailParts.push(<span key="date-past" className="text-red-600 font-semibold">Data Venceu há {Math.abs(diffDays)} dia(s)</span>);
                           } else if (isToday(scheduledDateObj)) {
                               detailParts.push(<span key="date-today" className="text-red-600 font-semibold">Data Vence Hoje</span>);
                           } else if (scheduledDateObj > today && scheduledDateObj <= oneWeekFromNow) { // Only within the next 7 days
                               detailParts.push(<span key="date-upcoming" className="text-orange-500 font-semibold">Data em {diffDays} dia(s)</span>);
                           } else {
                                // Date is beyond 7 days, still show basic info if no KM alert
                                // detailParts.push(<span key="date-info">Data Ag: {format(scheduledDateObj, 'dd/MM/yy', {locale: ptBR})}</span>);
                           }
                       }

                       if (maint.scheduledKm && typeof selectedVehicleForAlert.mileage === 'number') {
                           const currentKm = selectedVehicleForAlert.mileage;
                           const scheduledKmNum = maint.scheduledKm;
                           if (currentKm >= scheduledKmNum) {
                               detailParts.push(<span key="km-overdue" className="text-red-600 font-semibold">KM Vencido (Atual: {currentKm.toLocaleString('pt-BR')})</span>);
                           } else if (scheduledKmNum > currentKm && scheduledKmNum <= currentKm + 11000) { 
                               detailParts.push(<span key="km-upcoming" className="text-orange-500 font-semibold">Próx. KM em {(scheduledKmNum - currentKm).toLocaleString('pt-BR')} km</span>);
                           } else {
                                // KM is beyond 11000km, still show basic info if no Date alert
                                // detailParts.push(<span key="km-info">KM Ag: {scheduledKmNum.toLocaleString('pt-BR')}</span>);
                           }
                       }
                       
                       const renderedDetailParts = detailParts.filter(part => part !== null && part !== "");
                       const detailDisplay = renderedDetailParts.length > 0 ? 
                          renderedDetailParts.reduce((prev, curr, idx) => [prev, (idx > 0 ? <span key={`sep-${idx}`}>; </span> : null), curr] as any) : null;


                       return (
                          <li key={maint.id} className="text-xs">
                            <div className="font-medium">{maint.description.substring(0,100)}... {detailDisplay && <>({detailDisplay})</>}</div>
                            <Badge className={`mt-1 text-xs text-white ${statusInfo.className}`}>
                                {statusInfo.label}
                            </Badge>
                          </li>
                       );
                    })}
                  </ul>
                </ScrollArea>
                 <p className="text-sm text-muted-foreground pt-2">
                    Deseja pegar este veículo mesmo assim?
                  </p>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelPickUp}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmPickUpVehicleAfterIncidentOrMaintenance} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                Pegar Mesmo Assim
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      
      <UpdateMileageDialog
        isOpen={isUpdateMileageDialogOpen}
        onOpenChange={setIsUpdateMileageDialogOpen}
        vehicle={vehicleToReturn}
        onSubmitMileage={handleConfirmReturnWithMileage}
        isSubmitting={returnMutation.isPending}
      />

    </Container>
  );
}
    

    

