
'use client';
import type { Vehicle, User } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle2Icon, AlertTriangleIcon, BanIcon, CalendarClockIcon } from 'lucide-react';
import type { ReactNode} from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserById } from '@/lib/services/userService';
import { Skeleton } from '../ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface VehicleCardProps {
  vehicle: Vehicle;
  actionSlot?: ReactNode;
  operatorName?: string; 
}

export function VehicleCard({ vehicle, actionSlot, operatorName: passedOperatorName }: VehicleCardProps) {
  const statusConfig = {
    active: {
      label: 'Ativo',
      className: 'bg-green-500 hover:bg-green-600',
      icon: <CheckCircle2Icon className="mr-1 h-3 w-3" />,
    },
    maintenance: {
      label: 'Manutenção',
      className: 'bg-yellow-500 hover:bg-yellow-600',
      icon: <AlertTriangleIcon className="mr-1 h-3 w-3" />,
    },
    inactive: {
      label: 'Inativo',
      className: 'bg-gray-500 hover:bg-gray-600',
      icon: <BanIcon className="mr-1 h-3 w-3" />,
    },
  };

  const currentStatus = statusConfig[vehicle.status] || statusConfig.inactive;

  const { data: assignedOperator, isLoading: operatorLoading } = useQuery<User | null, Error>({
    queryKey: ['user', vehicle.assignedOperatorId],
    queryFn: () => vehicle.assignedOperatorId ? getUserById(vehicle.assignedOperatorId) : null,
    enabled: !!vehicle.assignedOperatorId && !passedOperatorName, 
  });
  
  const displayOperatorName = passedOperatorName || assignedOperator?.name || 'Operador Desconhecido';


  return (
    <Card className="flex flex-col overflow-hidden shadow-lg transition-all hover:shadow-xl">
      <CardHeader className="p-0">
        {vehicle.imageUrl ? (
          <div className="relative h-48 w-full">
            <Image
              src={vehicle.imageUrl}
              alt={`${vehicle.make} ${vehicle.model}`}
              fill 
              style={{objectFit:"cover"}} 
              data-ai-hint="vehicle car"
              priority={true} // Consider adding priority if this image is LCP
            />
          </div>
        ): (
          <div className="relative h-48 w-full bg-muted flex items-center justify-center" data-ai-hint="vehicle car">
            <TruckIcon className="h-16 w-16 text-muted-foreground" />
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-grow p-4">
        <div className="flex justify-between items-start mb-2">
          <CardTitle className="text-xl">{vehicle.make} {vehicle.model}</CardTitle>
          <Badge 
            className={cn("text-white", currentStatus.className)}
          >
            {currentStatus.icon}
            {currentStatus.label}
          </Badge>
        </div>
        <CardDescription className="text-sm text-muted-foreground">Placa: {vehicle.plate} | Ano: {vehicle.year}</CardDescription>
        <p className="mt-2 text-sm">Quilometragem: {vehicle.mileage?.toLocaleString('pt-BR') || 'N/A'} km</p>
        {vehicle.assignedOperatorId && (
          <p className="mt-1 text-xs text-primary/80">
            Com: {operatorLoading ? <Skeleton className="h-4 w-24 inline-block" /> : displayOperatorName}
          </p>
        )}
        {vehicle.assignedOperatorId && vehicle.pickedUpDate && (
          <p className="mt-1 text-xs text-muted-foreground flex items-center">
             <CalendarClockIcon className="mr-1 h-3 w-3" />
            Retirado em: {format(new Date(vehicle.pickedUpDate), 'dd/MM/yy HH:mm', { locale: ptBR })}
          </p>
        )}
      </CardContent>
      {actionSlot && 
        <CardFooter className="p-4 bg-secondary/30">
            {actionSlot}
        </CardFooter>
      }
    </Card>
  );
}

// Placeholder for TruckIcon
const TruckIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("lucide lucide-truck", className)}>
    <path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11"/>
    <path d="M14 9h4l4 5v4h-3v-4h-3V9Z"/>
    <circle cx="7" cy="18" r="2"/>
    <circle cx="17" cy="18" r="2"/>
  </svg>
);
