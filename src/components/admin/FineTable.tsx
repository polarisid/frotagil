
'use client';

import React from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  EyeIcon,
  MoreHorizontalIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  ShieldQuestionIcon,
  XCircleIcon,
  ReceiptTextIcon,
  Edit3Icon, // Ícone para editar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateFine } from '@/lib/services/fineService';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
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
import type { Fine, User, Vehicle } from '@/lib/types';

interface FineTableProps {
  fines: Fine[];
  users: User[];
  vehicles: Vehicle[];
}

export function FineTable({ fines, users, vehicles }: FineTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAlertOpen, setIsAlertOpen] = useState<boolean>(false);
  const [fineToUpdateStatus, setFineToUpdateStatus] = useState<Fine | null>(null);
  const [newStatusForFine, setNewStatusForFine] = useState<Fine['status'] | null>(null);

  const getOperatorName = (operatorId: string): string => {
    const user = users.find(u => u.id === operatorId);
    return user?.name || 'Desconhecido';
  };

  const getVehiclePlate = (vehicleId: string): string => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle?.plate || 'N/A';
  };

  const updateFineStatusMutation = useMutation({
    mutationFn: ({ fineId, status }: { fineId: string; status: Fine['status'] }) =>
      updateFine(fineId, { status }),
    onSuccess: (_, { status }) => {
      toast({ title: 'Status da Multa Atualizado', description: `Multa marcada como ${statusConfig[status]?.label || status}.` });
      queryClient.invalidateQueries({ queryKey: ['fines'] });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao Atualizar Status', description: error.message });
    },
    onSettled: () => {
      setFineToUpdateStatus(null);
      setNewStatusForFine(null);
      setIsAlertOpen(false);
    }
  });

  const handleStatusUpdateRequest = (fine: Fine, status: Fine['status']): void => {
    setFineToUpdateStatus(fine);
    setNewStatusForFine(status);
    setIsAlertOpen(true);
  };

  const confirmStatusUpdate = (): void => {
    if (fineToUpdateStatus && newStatusForFine) {
      updateFineStatusMutation.mutate({ fineId: fineToUpdateStatus.id, status: newStatusForFine });
    }
  };

  const statusConfig: Record<Fine['status'], { label: string; icon: React.ElementType; className: string, darkClassName?: string }> = {
    pending: { label: 'Pendente', icon: AlertCircleIcon, className: 'bg-yellow-100 text-yellow-700 border-yellow-300', darkClassName: 'dark:bg-yellow-700/30 dark:text-yellow-300 dark:border-yellow-600' },
    paid: { label: 'Paga', icon: CheckCircle2Icon, className: 'bg-green-100 text-green-700 border-green-300', darkClassName: 'dark:bg-green-700/30 dark:text-green-300 dark:border-green-600' },
    appealed: { label: 'Recorrida', icon: ShieldQuestionIcon, className: 'bg-blue-100 text-blue-700 border-blue-300', darkClassName: 'dark:bg-blue-700/30 dark:text-blue-300 dark:border-blue-600' },
    cancelled: { label: 'Cancelada', icon: XCircleIcon, className: 'bg-red-100 text-red-700 border-red-300', darkClassName: 'dark:bg-red-700/30 dark:text-red-300 dark:border-red-600' },
  };

  const handleViewDetails = (fine: Fine): void => {
    toast({
      title: `Detalhes da Multa #${fine.id.substring(0, 8)}`,
      description: (
        <div className="text-sm space-y-1">
          <p><strong>Veículo:</strong> {getVehiclePlate(fine.vehicleId)}</p>
          <p><strong>Operador:</strong> {getOperatorName(fine.operatorId)}</p>
          <p><strong>Cód. Infração:</strong> {fine.infractionCode}</p>
          <p><strong>Descrição:</strong> {fine.description}</p>
          <p><strong>Local:</strong> {fine.location}</p>
          <p><strong>Data:</strong> {format(parseISO(fine.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
          <p><strong>Vencimento:</strong> {format(parseISO(fine.dueDate), "dd/MM/yyyy", { locale: ptBR })}</p>
          <p><strong>Valor:</strong> R$ {fine.amount.toFixed(2)}</p>
          <p><strong>Status:</strong> {statusConfig[fine.status]?.label || fine.status}</p>
          {fine.adminNotes && <p><strong>Notas Admin:</strong> {fine.adminNotes}</p>}
        </div>
      ),
      duration: 15000,
    });
  };

  return (
    <>
      <div className="overflow-hidden rounded-lg border shadow-md">
        <Table>
          <TableHeader className="bg-secondary">
            <TableRow>
              <TableHead>Data Infração</TableHead>
              <TableHead>Operador</TableHead>
              <TableHead>Veículo</TableHead>
              <TableHead className="hidden md:table-cell">Cód. Infração</TableHead>
              <TableHead className="hidden lg:table-cell">Valor (R$)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fines.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Nenhuma multa encontrada.
                </TableCell>
              </TableRow>
            )}
            {fines.map((fine) => {
              const currentStatus = statusConfig[fine.status] || { label: fine.status, icon: ReceiptTextIcon, className: 'bg-gray-200 text-gray-800 border-gray-500', darkClassName: 'dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600' };
              const StatusIcon = currentStatus.icon;
              return (
                <TableRow key={fine.id} className="hover:bg-muted/50">
                  <TableCell>{format(parseISO(fine.date), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                  <TableCell>{getOperatorName(fine.operatorId)}</TableCell>
                  <TableCell>{getVehiclePlate(fine.vehicleId)}</TableCell>
                  <TableCell className="hidden md:table-cell">{fine.infractionCode}</TableCell>
                  <TableCell className="hidden lg:table-cell">{fine.amount.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs border", currentStatus.className, currentStatus.darkClassName)}>
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {currentStatus.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={updateFineStatusMutation.isPending}>
                          <MoreHorizontalIcon className="h-4 w-4" />
                          <span className="sr-only">Ações</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Opções da Multa</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleViewDetails(fine)}>
                          <EyeIcon className="mr-2 h-4 w-4" /> Ver Detalhes
                        </DropdownMenuItem>
                        {fine.status === 'pending' && (
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/fines/edit/${fine.id}`}>
                              <Edit3Icon className="mr-2 h-4 w-4" /> Editar Multa
                            </Link>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {(Object.keys(statusConfig) as Array<Fine['status']>).map((statusKey) => (
                          fine.status !== statusKey && (
                            <DropdownMenuItem
                              key={statusKey}
                              onClick={() => handleStatusUpdateRequest(fine, statusKey)}
                              disabled={updateFineStatusMutation.isPending}
                            >
                              {React.createElement(statusConfig[statusKey].icon, { className: "mr-2 h-4 w-4" })}
                              Marcar como {statusConfig[statusKey].label}
                            </DropdownMenuItem>
                          )
                        ))}
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
            <AlertDialogTitle>Confirmar Alteração de Status</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja alterar o status da multa #{fineToUpdateStatus?.id.substring(0,8)} para "{newStatusForFine ? statusConfig[newStatusForFine]?.label : ''}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setFineToUpdateStatus(null); setNewStatusForFine(null); }} disabled={updateFineStatusMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStatusUpdate}
              className={cn(buttonVariants({ variant: "default" }), "bg-accent hover:bg-accent/90 text-accent-foreground")}
              disabled={updateFineStatusMutation.isPending}
            >
              {updateFineStatusMutation.isPending ? "Alterando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
