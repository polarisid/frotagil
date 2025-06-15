
'use client';

import type { Incident, Vehicle, User } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EyeIcon, MoreHorizontalIcon, WrenchIcon, ShieldCheckIcon, ShieldAlertIcon, ShieldXIcon, XCircleIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link'; // Import Link
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateIncident } from '@/lib/services/incidentService';
import { format } from 'date-fns';

interface IncidentTableProps {
  incidents: Incident[];
  vehicles: Vehicle[];
  users: User[];
}

export function IncidentTable({ incidents, vehicles, users }: IncidentTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();


  const updateIncidentStatusMutation = useMutation({
    mutationFn: ({incidentId, status}: {incidentId: string, status: Incident['status']}) => updateIncident(incidentId, {status}),
    onSuccess: (_, {status}) => {
        toast({ title: 'Status da Ocorrência Atualizado', description: `Ocorrência marcada como ${statusConfig[status]?.label || status}.` });
        queryClient.invalidateQueries({ queryKey: ['incidents']});
    },
    onError: (error: Error) => {
        toast({ variant: 'destructive', title: 'Erro ao atualizar status', description: error.message});
    }
  });


  const getVehicleInfo = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.plate})` : 'N/A';
  };

  const getOperatorName = (operatorId: string, operatorName?: string) => {
    if (operatorName) return operatorName;
    const user = users.find(u => u.id === operatorId);
    return user ? user.name : 'N/A';
  };

  const statusConfig: Record<Incident['status'], { label: string; icon: React.ElementType; className: string }> = {
    reported: { label: 'Reportado', icon: ShieldAlertIcon, className: 'bg-blue-100 text-blue-700 border-blue-500' },
    under_analysis: { label: 'Em Análise', icon: ShieldAlertIcon, className: 'bg-yellow-100 text-yellow-700 border-yellow-500' },
    pending_action: { label: 'Ação Pendente', icon: WrenchIcon, className: 'bg-orange-100 text-orange-700 border-orange-500' },
    resolved: { label: 'Resolvido', icon: ShieldCheckIcon, className: 'bg-green-100 text-green-700 border-green-500' },
    cancelled: { label: 'Cancelado', icon: XCircleIcon, className: 'bg-red-100 text-red-700 border-red-500' },
  };

  const handleViewDetails = (incident: Incident) => {
    toast({
      title: `Detalhes do Sinistro #${incident.id.substring(0,8)}`,
      description: (
        <div className="text-sm space-y-1">
          <p><strong>Veículo:</strong> {getVehicleInfo(incident.vehicleId)}</p>
          <p><strong>Operador:</strong> {getOperatorName(incident.operatorId, incident.operatorName)}</p>
          <p><strong>Data:</strong> {format(new Date(incident.date), "dd/MM/yyyy 'às' HH:mm")}</p>
          <p><strong>Descrição:</strong> {incident.description}</p>
          <p><strong>Status:</strong> {statusConfig[incident.status]?.label || incident.status}</p>
        </div>
      ),
      duration: 10000,
    });
  };


  return (
    <div className="overflow-hidden rounded-lg border shadow-md">
      <Table>
        <TableHeader className="bg-secondary">
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Operador</TableHead>
            <TableHead>Veículo</TableHead>
            <TableHead className="hidden md:table-cell">Descrição Resumida</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                Nenhum sinistro ou ocorrência registrada.
              </TableCell>
            </TableRow>
          )}
          {incidents.map((incident) => {
            const currentStatus = statusConfig[incident.status] || { label: incident.status, icon: ShieldXIcon, className: 'bg-gray-100 text-gray-700 border-gray-500' };
            const Icon = currentStatus.icon;
            const maintenanceDescription = `Manutenção corretiva referente à ocorrência: ${incident.description.substring(0, 100)}${incident.description.length > 100 ? "..." : ""}`;
            return (
              <TableRow key={incident.id} className="hover:bg-muted/50">
                <TableCell>
                  {format(new Date(incident.date), "dd/MM/yy")}
                </TableCell>
                <TableCell>{getOperatorName(incident.operatorId, incident.operatorName)}</TableCell>
                <TableCell>{getVehicleInfo(incident.vehicleId)}</TableCell>
                <TableCell className="hidden md:table-cell truncate max-w-xs">
                  {incident.description}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("text-xs", currentStatus.className)}>
                    <Icon className="mr-1 h-3 w-3" />
                    {currentStatus.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={updateIncidentStatusMutation.isLoading}>
                        <MoreHorizontalIcon className="h-4 w-4" />
                        <span className="sr-only">Ações</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Opções do Sinistro</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleViewDetails(incident)}>
                        <EyeIcon className="mr-2 h-4 w-4" /> Ver Detalhes
                      </DropdownMenuItem>
                      { (incident.status === 'reported' || incident.status === 'under_analysis' || incident.status === 'pending_action') &&
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/maintenances/new?incidentId=${incident.id}&vehicleId=${incident.vehicleId}&description=${encodeURIComponent(maintenanceDescription)}`}>
                            <WrenchIcon className="mr-2 h-4 w-4" /> Criar Manutenção
                          </Link>
                        </DropdownMenuItem>
                      }
                       {incident.status === 'reported' && (
                        <DropdownMenuItem onClick={() => updateIncidentStatusMutation.mutate({incidentId: incident.id, status: 'under_analysis'})} disabled={updateIncidentStatusMutation.isLoading}>
                             <ShieldAlertIcon className="mr-2 h-4 w-4" /> Iniciar Análise
                        </DropdownMenuItem>
                      )}
                      {incident.status !== 'resolved' && incident.status !== 'cancelled' && (
                        <DropdownMenuItem onClick={() => updateIncidentStatusMutation.mutate({incidentId: incident.id, status: 'resolved'})} disabled={updateIncidentStatusMutation.isLoading}>
                             <ShieldCheckIcon className="mr-2 h-4 w-4" /> Marcar como Resolvido
                        </DropdownMenuItem>
                      )}
                      {incident.status !== 'resolved' && incident.status !== 'cancelled' && (
                        <DropdownMenuItem 
                          onClick={() => updateIncidentStatusMutation.mutate({incidentId: incident.id, status: 'cancelled'})} 
                          disabled={updateIncidentStatusMutation.isLoading}
                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        >
                             <XCircleIcon className="mr-2 h-4 w-4" /> Cancelar Sinistro
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}


