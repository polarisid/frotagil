
'use client';

import type { Vehicle } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button'; // Added buttonVariants import
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Edit3Icon, Trash2Icon, MoreHorizontalIcon, EyeIcon, WrenchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteVehicle } from '@/lib/services/vehicleService';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from 'react';


interface VehicleTableProps {
  vehicles: Vehicle[];
}

export function VehicleTable({ vehicles }: VehicleTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);


  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: deleteVehicle,
    onSuccess: (_, vehicleId) => {
      toast({ title: 'Veículo Excluído', description: `Veículo ${vehicleToDelete?.plate || vehicleId} excluído com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: (error, vehicleId) => {
      toast({ variant: "destructive", title: 'Erro ao Excluir', description: error.message || `Não foi possível excluir o veículo ${vehicleToDelete?.plate || vehicleId}.` });
    },
  });

  const handleDeleteConfirmation = (vehicle: Vehicle) => {
    setVehicleToDelete(vehicle);
    setIsAlertOpen(true);
  };

  const confirmDelete = () => {
    if (vehicleToDelete) {
      deleteMutation.mutate(vehicleToDelete.id);
    }
    setIsAlertOpen(false);
    setVehicleToDelete(null);
  };
  
  const statusStyles = {
    active: 'border-green-500 text-green-700 bg-green-100 dark:bg-green-800 dark:text-green-200 dark:border-green-700',
    maintenance: 'border-yellow-500 text-yellow-700 bg-yellow-100 dark:bg-yellow-800 dark:text-yellow-200 dark:border-yellow-700',
    inactive: 'border-gray-500 text-gray-700 bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
  };


  return (
    <>
    <div className="overflow-hidden rounded-lg border shadow-md">
      <Table>
        <TableHeader className="bg-secondary">
          <TableRow>
            <TableHead>Placa</TableHead>
            <TableHead>Modelo</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead className="hidden md:table-cell">Ano</TableHead>
            <TableHead className="hidden lg:table-cell">Aquisição</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehicles.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                Nenhum veículo cadastrado.
              </TableCell>
            </TableRow>
          )}
          {vehicles.map((vehicle) => (
            <TableRow key={vehicle.id} className="hover:bg-muted/50">
              <TableCell className="font-medium">{vehicle.plate}</TableCell>
              <TableCell>{vehicle.model}</TableCell>
              <TableCell>{vehicle.make}</TableCell>
              <TableCell className="hidden md:table-cell">{vehicle.year}</TableCell>
              <TableCell className="hidden lg:table-cell">
                {vehicle.acquisitionDate ? new Date(vehicle.acquisitionDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={cn("capitalize", statusStyles[vehicle.status])}>
                  {vehicle.status === 'active' ? 'Ativo' : vehicle.status === 'maintenance' ? 'Manutenção' : 'Inativo'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={deleteMutation.isPending && vehicleToDelete?.id === vehicle.id}>
                      <MoreHorizontalIcon className="h-4 w-4" />
                       <span className="sr-only">Ações</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Opções</DropdownMenuLabel>
                    {/* Placeholder for view details, implement if needed */}
                    {/* <DropdownMenuItem onClick={() => toast({title: "Visualizar (UI)", description:`Veículo ${vehicle.plate}`})}>
                      <EyeIcon className="mr-2 h-4 w-4" /> Visualizar Detalhes
                    </DropdownMenuItem> */}
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/vehicles/edit/${vehicle.id}`}>
                        <Edit3Icon className="mr-2 h-4 w-4" /> Editar
                      </Link>
                    </DropdownMenuItem>
                     <DropdownMenuItem asChild>
                       <Link href={`/admin/maintenances/new?vehicleId=${vehicle.id}`}>
                         <WrenchIcon className="mr-2 h-4 w-4" /> Agendar Manutenção
                       </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDeleteConfirmation(vehicle)}
                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      disabled={deleteMutation.isPending && vehicleToDelete?.id === vehicle.id}
                    >
                      <Trash2Icon className="mr-2 h-4 w-4" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o veículo {vehicleToDelete?.plate} ({vehicleToDelete?.make} {vehicleToDelete?.model})? Esta ação não pode ser desfeita.
              Checklists, manutenções e ocorrências associadas também podem ser afetados ou excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setVehicleToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className={cn(buttonVariants({ variant: "destructive" }))} // Ensure cn is used if other classes might be added later
              disabled={deleteMutation.isPending && vehicleToDelete?.id === vehicleToDelete?.id}
            >
              {(deleteMutation.isPending && vehicleToDelete?.id === vehicleToDelete?.id) ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
