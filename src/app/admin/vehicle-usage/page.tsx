
'use client';

import { useState, useEffect } from 'react';
import { Container } from '@/components/shared/Container';
import { PageTitle } from '@/components/shared/PageTitle';
import { VehicleUsageTable } from '@/components/admin/VehicleUsageTable';
import type { VehicleUsageLog, Vehicle, User } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import { getVehicleUsageLogs } from '@/lib/services/vehicleUsageLogService';
import { getVehicles } from '@/lib/services/vehicleService';
import { getUsers } from '@/lib/services/userService';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, FilterIcon, SearchIcon } from 'lucide-react';
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function VehicleUsagePage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const { data: usageLogs, isLoading: logsLoading, error: logsError } = useQuery<VehicleUsageLog[], Error>({
    queryKey: ['vehicleUsageLogs', format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: () => getVehicleUsageLogs({ 
      startDate: format(currentWeekStart, 'yyyy-MM-dd'),
      endDate: format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    }),
  });

  const { data: vehicles, isLoading: vehiclesLoading, error: vehiclesError } = useQuery<Vehicle[], Error>({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
  });

  const { data: users, isLoading: usersLoading, error: usersError } = useQuery<User[], Error>({
    queryKey: ['users'],
    queryFn: getUsers,
  });

  const isLoading = logsLoading || vehiclesLoading || usersLoading;
  const queryError = logsError || vehiclesError || usersError;

  const handlePreviousWeek = () => {
    setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };
  
  const handleDateSelect = (date?: Date) => {
    if (date) {
      setCurrentWeekStart(startOfWeek(date, { weekStartsOn: 1 }));
    }
  };

  if (isLoading) {
    return (
      <Container>
        <PageTitle title="Histórico de Uso de Veículos" description="Carregando dados de uso..." />
        <Card className="mb-6 shadow-md">
          <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Skeleton className="h-96 w-full" />
      </Container>
    );
  }

  if (queryError) {
    return <Container><PageTitle title="Erro" description={`Não foi possível carregar os dados: ${queryError.message}`} /></Container>;
  }

  const weekStartFormatted = format(currentWeekStart, "dd 'de' MMM", { locale: ptBR });
  const weekEndFormatted = format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "dd 'de' MMM 'de' yyyy", { locale: ptBR });


  return (
    <Container>
      <PageTitle
        title="Histórico de Uso de Veículos"
        description="Visualize o histórico de quem utilizou os veículos e por quanto tempo."
      />

      <Card className="mb-6 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center text-xl">
            <FilterIcon className="mr-2 h-5 w-5 text-primary" />
            Selecionar Período
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <Button onClick={handlePreviousWeek} variant="outline">Anterior</Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[280px] justify-center text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <span>Semana de {weekStartFormatted} a {weekEndFormatted}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={currentWeekStart}
                  onSelect={handleDateSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button onClick={handleNextWeek} variant="outline">Próxima</Button>
          </div>
          {/* Futuros filtros por veículo ou motorista podem ser adicionados aqui */}
        </CardContent>
      </Card>
      
      <VehicleUsageTable
        usageLogs={usageLogs || []}
        vehicles={vehicles || []}
        users={users || []}
      />
    </Container>
  );
}
