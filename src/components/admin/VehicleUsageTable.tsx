
'use client';

import type { VehicleUsageLog, Vehicle, User } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, intervalToDuration, formatDuration } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClockIcon, CheckCircle2Icon, TruckIcon, RouteIcon, TrendingUpIcon, TrendingDownIcon } from 'lucide-react';

interface VehicleUsageTableProps {
  usageLogs: VehicleUsageLog[];
  vehicles: Vehicle[]; // Not strictly needed if denormalized, but good for fallback
  users: User[];     // Not strictly needed if denormalized, but good for fallback
}

export function VehicleUsageTable({ usageLogs, vehicles, users }: VehicleUsageTableProps) {
  
  const formatTimestamp = (isoString?: string | null): string => {
    if (!isoString) return 'Em uso';
    try {
      return format(new Date(isoString), "dd/MM/yy HH:mm", { locale: ptBR });
    } catch (error) {
      return 'Data inválida';
    }
  };

  const getDuration = (log: VehicleUsageLog): string => {
    if (log.status === 'active' || !log.returnedTimestamp || !log.pickedUpTimestamp) {
      return 'Em uso';
    }
    if (log.durationMinutes !== undefined) {
      const duration = intervalToDuration({ start: 0, end: log.durationMinutes * 60 * 1000 });
      return formatDuration(duration, { format: ['days', 'hours', 'minutes'], locale: ptBR }) || '0 minutos';
    }
    // Fallback calculation if durationMinutes is not present
    try {
        const start = new Date(log.pickedUpTimestamp);
        const end = new Date(log.returnedTimestamp);
        const duration = intervalToDuration({ start, end });
        return formatDuration(duration, { format: ['days', 'hours', 'minutes'], locale: ptBR }) || '0 minutos';
    } catch {
        return "Erro no cálculo";
    }
  };

  const getVehicleDisplay = (log: VehicleUsageLog) => {
    const vehicle = vehicles.find(v => v.id === log.vehicleId);
    return `${log.vehiclePlate}${vehicle ? ` (${vehicle.make} ${vehicle.model})` : ''}`;
  };

  const getOperatorDisplay = (log: VehicleUsageLog) => {
    return log.operatorName || users.find(u => u.id === log.operatorId)?.name || 'Desconhecido';
  };

  const formatKm = (km?: number) => {
    if (km === undefined || km === null) return '-';
    return `${km.toLocaleString('pt-BR')} km`;
  };
  
  if (usageLogs.length === 0) {
    return (
      <div className="mt-6 text-center text-muted-foreground py-10 border rounded-md shadow-sm">
        <TruckIcon className="mx-auto h-12 w-12 mb-4 text-primary/50" />
        <p className="text-lg">Nenhum registro de uso de veículo encontrado para o período selecionado.</p>
        <p className="text-sm">Tente selecionar outra semana ou verifique se os motoristas estão registrando as coletas e devoluções.</p>
      </div>
    );
  }


  return (
    <div className="overflow-hidden rounded-lg border shadow-md">
      <Table>
        <TableHeader className="bg-secondary">
          <TableRow>
            <TableHead>Veículo</TableHead>
            <TableHead>Motorista</TableHead>
            <TableHead className="hidden lg:table-cell">Retirada</TableHead>
            <TableHead className="hidden lg:table-cell">Devolução</TableHead>
            <TableHead className="hidden xl:table-cell">Duração</TableHead>
            <TableHead className="hidden md:table-cell">Rota</TableHead>
            <TableHead className="text-right">KM Inicial</TableHead>
            <TableHead className="text-right">KM Final</TableHead>
            <TableHead className="text-right">KM Rodado</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usageLogs.map((log) => (
            <TableRow key={log.id} className="hover:bg-muted/50">
              <TableCell className="font-medium">{getVehicleDisplay(log)}</TableCell>
              <TableCell>{getOperatorDisplay(log)}</TableCell>
              <TableCell className="hidden lg:table-cell">{formatTimestamp(log.pickedUpTimestamp)}</TableCell>
              <TableCell className="hidden lg:table-cell">{log.status === 'completed' ? formatTimestamp(log.returnedTimestamp) : 'Em uso'}</TableCell>
              <TableCell className="hidden xl:table-cell">{getDuration(log)}</TableCell>
              <TableCell className="hidden md:table-cell truncate max-w-[150px]">
                {log.routeDescription || '-'}
              </TableCell>
              <TableCell className="text-right">{formatKm(log.initialMileage)}</TableCell>
              <TableCell className="text-right">{log.status === 'completed' ? formatKm(log.finalMileage) : '-'}</TableCell>
              <TableCell className="text-right">{log.status === 'completed' ? formatKm(log.kmDriven) : '-'}</TableCell>
              <TableCell>
                {log.status === 'completed' ? (
                  <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">
                    <CheckCircle2Icon className="mr-1 h-3 w-3" /> Concluído
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-blue-500 text-blue-700 bg-blue-100">
                    <ClockIcon className="mr-1 h-3 w-3" /> Em Uso
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
