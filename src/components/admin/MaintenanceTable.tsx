
'use client';

import type { Maintenance, Vehicle } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EyeIcon, Edit3Icon, MoreHorizontalIcon, CheckCircle2Icon, Settings2Icon, XCircleIcon, ClockIcon, Trash2Icon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateMaintenance, deleteMaintenance as deleteMaintenanceService } from '@/lib/services/maintenanceService';
import { format } from 'date-fns';
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
import { useState } from 'react';


interface MaintenanceTableProps {
  maintenances: Maintenance[];
  vehicles: Vehicle[];
}

export function MaintenanceTable({ maintenances, vehicles }: MaintenanceTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [maintenanceToDelete, setMaintenanceToDelete] = useState<Maintenance | null>(null);

  console.log('[MaintenanceTable] maintenances prop received:', maintenances);


  const getVehicleInfo = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.plate})` : 'N/A';
  };

  const statusConfig = {
    planned: { label: 'Planejada', icon: ClockIcon, className: 'bg-blue-100 text-blue-700 border-blue-500' },
    in_progress: { label: 'Em Progresso', icon: Settings2Icon, className: 'bg-yellow-100 text-yellow-700 border-yellow-500' },
    completed: { label: 'Concluída', icon: CheckCircle2Icon, className: 'bg-green-100 text-green-700 border-green-500' },
    cancelled: { label: 'Cancelada', icon: XCircleIcon, className: 'bg-red-100 text-red-700 border-red-500' },
  };

  const markAsCompletedMutation = useMutation({
    mutationFn: (maintenanceId: string) => updateMaintenance(maintenanceId, { 
        status: 'completed', 
        completionDate: format(new Date(), 'yyyy-MM-dd') 
    }),
    onSuccess: (_, maintenanceId) => {
        toast({ title: 'Manutenção Concluída', description: `Manutenção marcada como concluída.` });
        queryClient.invalidateQueries({ queryKey: ['maintenances'] });
        queryClient.invalidateQueries({ queryKey: ['maintenance', maintenanceId] });
    },
    onError: (error: Error) => {
        toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Não foi possível marcar como concluída.' });
    }
  });

  const deleteMaintenanceMutation = useMutation({
    mutationFn: deleteMaintenanceService,
    onSuccess: (_, maintenanceId) => {
      toast({ title: 'Manutenção Excluída', description: `Manutenção ${maintenanceToDelete?.description.substring(0,20) || maintenanceId}... excluída com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      setMaintenanceToDelete(null);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: 'Erro ao Excluir Manutenção', description: error.message || 'Não foi possível excluir a manutenção.' });
      setMaintenanceToDelete(null);
    },
  });

  const handleDeleteConfirmation = (maintenance: Maintenance) => {
    setMaintenanceToDelete(maintenance);
    setIsAlertOpen(true);
  };

  const confirmDelete = () => {
    if (maintenanceToDelete) {
      deleteMaintenanceMutation.mutate(maintenanceToDelete.id);
    }
    setIsAlertOpen(false);
  };


  const handleViewDetails = (maintenance: Maintenance) => {
    toast({
      title: `Detalhes da Manutenção ${maintenance.id.substring(0,8)}`,
      description: (
        <div className="text-sm space-y-1">
          <p><strong>Veículo:</strong> {getVehicleInfo(maintenance.vehicleId)}</p>
          <p><strong>Tipo:</strong> {maintenance.type === 'corrective' ? 'Corretiva' : 'Preventiva'}</p>
          <p><strong>Descrição:</strong> {maintenance.description}</p>
          <p><strong>Status:</strong> {statusConfig[maintenance.status]?.label || maintenance.status}</p>
          {maintenance.scheduledDate && <p><strong>Data Ag.:</strong> {new Date(maintenance.scheduledDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>}
          {maintenance.scheduledKm && <p><strong>KM Ag.:</strong> {maintenance.scheduledKm.toLocaleString('pt-BR')}</p>}
          {maintenance.cost && <p><strong>Custo:</strong> R$ {maintenance.cost.toFixed(2)}</p>}
          {maintenance.completionDate && <p><strong>Data Conclusão:</strong> {new Date(maintenance.completionDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>}
          {maintenance.observations && <p><strong>Obs:</strong> {maintenance.observations}</p>}
        </div>
      ),
      duration: 10000, // Longer duration for details
    });
  };

  return (
    <>
    <div className="overflow-hidden rounded-lg border shadow-md">
      <Table>
        <TableHeader className="bg-secondary">
          <TableRow>
            <TableHead>Veículo</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="hidden sm:table-cell">Tipo</TableHead>
            <TableHead className="hidden md:table-cell">Agendamento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {maintenances.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                Nenhuma manutenção registrada.
              </TableCell>
            </TableRow>
          )}
          {maintenances.map((maintenance) => {
            const currentStatus = statusConfig[maintenance.status] || { label: maintenance.status, icon: Settings2Icon, className: 'bg-gray-100 text-gray-700 border-gray-500' };
            const Icon = currentStatus.icon;
            return (
              <TableRow key={maintenance.id} className="hover:bg-muted/50">
                <TableCell>{getVehicleInfo(maintenance.vehicleId)}</TableCell>
                <TableCell className="truncate max-w-xs">{maintenance.description}</TableCell>
                <TableCell className="hidden sm:table-cell capitalize">{maintenance.type === 'corrective' ? 'Corretiva' : 'Preventiva'}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {maintenance.scheduledDate ? new Date(maintenance.scheduledDate + 'T00:00:00').toLocaleDateString('pt-BR') : 
                   maintenance.scheduledKm ? `${maintenance.scheduledKm.toLocaleString('pt-BR')} km` : '-'}
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
                      <Button variant="ghost" size="icon" disabled={markAsCompletedMutation.isPending && markAsCompletedMutation.variables === maintenance.id || deleteMaintenanceMutation.isPending && maintenanceToDelete?.id === maintenance.id}>
                        <MoreHorizontalIcon className="h-4 w-4" />
                        <span className="sr-only">Ações</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Opções de Manutenção</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleViewDetails(maintenance)}>
                        <EyeIcon className="mr-2 h-4 w-4" /> Ver Detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/maintenances/edit/${maintenance.id}`}>
                           <Edit3Icon className="mr-2 h-4 w-4" /> Editar
                        </Link>
                      </DropdownMenuItem>
                       {(maintenance.status === 'planned' || maintenance.status === 'in_progress') && (
                        <DropdownMenuItem onClick={() => markAsCompletedMutation.mutate(maintenance.id)} disabled={markAsCompletedMutation.isPending && markAsCompletedMutation.variables === maintenance.id}>
                          <CheckCircle2Icon className="mr-2 h-4 w-4" /> Marcar como Concluída
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteConfirmation(maintenance)}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        disabled={deleteMaintenanceMutation.isPending && maintenanceToDelete?.id === maintenance.id}
                      >
                        <Trash2Icon className="mr-2 h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>

    <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a manutenção "{maintenanceToDelete?.description}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMaintenanceToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className={cn(buttonVariants({ variant: "destructive" }))}
              disabled={deleteMaintenanceMutation.isPending && maintenanceToDelete?.id === maintenanceToDelete?.id}
            >
              {(deleteMaintenanceMutation.isPending && maintenanceToDelete?.id === maintenanceToDelete?.id) ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

