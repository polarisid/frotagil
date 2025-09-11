

'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Container } from '@/components/shared/Container';
import { PageTitle } from '@/components/shared/PageTitle';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getVehicleById } from '@/lib/services/vehicleService';
import { getChecklists } from '@/lib/services/checklistService';
import { getMaintenances } from '@/lib/services/maintenanceService';
import { getIncidents } from '@/lib/services/incidentService';
import { getVehicleUsageLogs } from '@/lib/services/vehicleUsageLogService';
import type { Vehicle, VehicleHistoryEvent, Checklist, Maintenance, Incident, VehicleUsageLog } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangleIcon,
  CarIcon,
  ClipboardCheckIcon,
  WrenchIcon,
  ShieldAlertIcon,
  HistoryIcon,
  CalendarIcon,
  UserIcon,
  RouteIcon,
} from 'lucide-react';

const EventIcon = ({ type }: { type: VehicleHistoryEvent['type'] }) => {
  const baseClasses = "h-10 w-10 p-2 rounded-full flex items-center justify-center text-white";
  switch (type) {
    case 'checklist':
      return <div className={`${baseClasses} bg-blue-500`}><ClipboardCheckIcon className="h-5 w-5" /></div>;
    case 'maintenance':
      return <div className={`${baseClasses} bg-yellow-500`}><WrenchIcon className="h-5 w-5" /></div>;
    case 'incident':
      return <div className={`${baseClasses} bg-red-500`}><ShieldAlertIcon className="h-5 w-5" /></div>;
    case 'usage':
      return <div className={`${baseClasses} bg-green-500`}><RouteIcon className="h-5 w-5" /></div>;
    default:
      return <div className={`${baseClasses} bg-gray-500`}><HistoryIcon className="h-5 w-5" /></div>;
  }
};

const EventCard = ({ event }: { event: VehicleHistoryEvent }) => {
  const { type, date, data } = event;
  let title = 'Evento Desconhecido';
  let details: React.ReactNode = null;

  const maintenanceStatusConfig: Record<Maintenance['status'], { label: string; className: string }> = {
    planned: { label: 'Planejada', className: 'bg-blue-100 text-blue-700' },
    in_progress: { label: 'Em Progresso', className: 'bg-yellow-100 text-yellow-700' },
    completed: { label: 'Concluída', className: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelada', className: 'bg-red-100 text-red-700' },
  };

  switch (type) {
    case 'checklist':
      const checklist = data as Checklist;
      title = 'Checklist Realizado';
      details = (
        <>
          <p>Operador: {checklist.operatorName}</p>
          <p>KM: {checklist.mileage.toLocaleString('pt-BR')}</p>
          <p>Rota: {checklist.routeDescription || 'N/A'}</p>
          <p>Observações: {checklist.observations || 'Nenhuma'}</p>
          <Button asChild variant="link" className="p-0 h-auto mt-1">
             <Link href={`/admin/checklists/view/${checklist.id}`}>Ver Detalhes</Link>
          </Button>
        </>
      );
      break;
    case 'maintenance':
      const maintenance = data as Maintenance;
      const maintStatusInfo = maintenanceStatusConfig[maintenance.status] || { label: maintenance.status, className: 'bg-gray-200' };
      title = `Manutenção: ${maintenance.type === 'corrective' ? 'Corretiva' : 'Preventiva'}`;
      details = (
        <>
          <p>Descrição: {maintenance.description}</p>
          <p>Status: <Badge variant="outline" className={maintStatusInfo.className}>{maintStatusInfo.label}</Badge></p>
          {maintenance.cost && <p>Custo: R$ {maintenance.cost.toFixed(2)}</p>}
          <Button asChild variant="link" className="p-0 h-auto mt-1">
             <Link href={`/admin/maintenances/edit/${maintenance.id}`}>Ver Detalhes</Link>
          </Button>
        </>
      );
      break;
    case 'incident':
      const incident = data as Incident;
      title = 'Ocorrência Registrada';
      details = (
        <>
          <p>Operador: {incident.operatorName}</p>
          <p>Descrição: {incident.description}</p>
          <p>Status: <Badge variant="destructive">{incident.status}</Badge></p>
        </>
      );
      break;
    case 'usage':
        const usage = data as VehicleUsageLog;
        title = `Registro de Uso`;
         details = (
            <>
                <p><UserIcon className="inline h-4 w-4 mr-1"/>{usage.operatorName}</p>
                <p>Retirada: {format(parseISO(usage.pickedUpTimestamp), 'dd/MM/yy HH:mm')}</p>
                {usage.status === 'completed' && usage.returnedTimestamp ? (
                    <>
                        <p>Devolução: {format(parseISO(usage.returnedTimestamp), 'dd/MM/yy HH:mm')}</p>
                        <p>KM Rodado: {usage.kmDriven?.toLocaleString('pt-BR') || 'N/A'}</p>
                    </>
                ) : (
                    <p className="text-blue-500 font-semibold">Em uso</p>
                )}
            </>
         );
  }

  return (
    <div className="relative pl-16">
      <div className="absolute left-5 top-0 z-10">
        <EventIcon type={type} />
      </div>
      <Card className="ml-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <CardDescription className="flex items-center text-xs">
            <CalendarIcon className="mr-1 h-3 w-3"/>
            {format(parseISO(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">{details}</CardContent>
      </Card>
    </div>
  );
};


export default function VehicleHistoryPage() {
  const params = useParams();
  const vehicleId = params.vehicleId as string;

  const { data: vehicle, isLoading: vehicleLoading, error: vehicleError } = useQuery<Vehicle | null>({
    queryKey: ['vehicle', vehicleId],
    queryFn: () => getVehicleById(vehicleId),
    enabled: !!vehicleId,
  });

  const { data: checklists, isLoading: checklistsLoading } = useQuery<Checklist[]>({
    queryKey: ['checklists', vehicleId],
    queryFn: () => getChecklists({ vehicleId }),
    enabled: !!vehicleId,
  });

  const { data: maintenances, isLoading: maintenancesLoading } = useQuery<Maintenance[]>({
    queryKey: ['maintenances', vehicleId],
    queryFn: () => getMaintenances({ vehicleId }),
    enabled: !!vehicleId,
  });

  const { data: incidents, isLoading: incidentsLoading } = useQuery<Incident[]>({
    queryKey: ['incidents', vehicleId],
    queryFn: () => getIncidents({ vehicleId }),
    enabled: !!vehicleId,
  });
  
  const { data: usageLogs, isLoading: usageLogsLoading } = useQuery<VehicleUsageLog[]>({
    queryKey: ['vehicleUsageLogs', vehicleId],
    queryFn: () => getVehicleUsageLogs({ vehicleId }),
    enabled: !!vehicleId,
  });


  const combinedHistory = useMemo((): VehicleHistoryEvent[] => {
    if (!checklists || !maintenances || !incidents || !usageLogs) return [];
    
    const checklistEvents: VehicleHistoryEvent[] = checklists.map(c => ({ type: 'checklist', date: c.date, data: c }));
    const maintenanceEvents: VehicleHistoryEvent[] = maintenances.map(m => ({ type: 'maintenance', date: m.completionDate || m.scheduledDate || m.workshopDropOffDate || m.id, data: m }));
    const incidentEvents: VehicleHistoryEvent[] = incidents.map(i => ({ type: 'incident', date: i.date, data: i }));
    const usageEvents: VehicleHistoryEvent[] = usageLogs.map(u => ({ type: 'usage', date: u.pickedUpTimestamp, data: u }));

    return [...checklistEvents, ...maintenanceEvents, ...incidentEvents, ...usageEvents].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [checklists, maintenances, incidents, usageLogs]);

  const isLoading = vehicleLoading || checklistsLoading || maintenancesLoading || incidentsLoading || usageLogsLoading;

  if (isLoading) {
    return (
      <Container>
        <Skeleton className="h-10 w-2/3 mb-4" />
        <Skeleton className="h-6 w-1/2 mb-8" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </Container>
    );
  }

  if (vehicleError) {
    return (
      <Container>
        <Alert variant="destructive">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Erro ao Carregar Veículo</AlertTitle>
          <AlertDescription>{vehicleError.message}</AlertDescription>
        </Alert>
      </Container>
    );
  }

  if (!vehicle) {
    return (
      <Container>
        <Alert variant="destructive">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Veículo Não Encontrado</AlertTitle>
          <AlertDescription>O veículo com o ID fornecido não foi encontrado.</AlertDescription>
        </Alert>
      </Container>
    );
  }

  return (
    <Container>
      <PageTitle
        title={`Histórico do Veículo: ${vehicle.plate}`}
        description={`${vehicle.make} ${vehicle.model} - Ano ${vehicle.year}`}
        icon={<CarIcon className="mr-2 h-6 w-6" />}
      />

      <div className="relative space-y-8">
         <div className="absolute left-9 top-0 bottom-0 w-0.5 bg-border -translate-x-1/2" aria-hidden="true" />
         
         {combinedHistory.length > 0 ? (
             combinedHistory.map((event, index) => (
                 <EventCard key={`${event.type}-${event.data.id}-${index}`} event={event} />
             ))
         ) : (
            <Alert>
                <HistoryIcon className="h-4 w-4" />
                <AlertTitle>Nenhum Evento</AlertTitle>
                <AlertDescription>Nenhum evento de histórico foi encontrado para este veículo ainda.</AlertDescription>
            </Alert>
         )}
      </div>

       <div className="mt-8 text-center">
        <Button asChild variant="outline">
          <Link href="/admin/vehicles">Voltar para a Lista de Veículos</Link>
        </Button>
      </div>
    </Container>
  );
}
