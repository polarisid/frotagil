
'use client';

import { useState } from 'react';
import { PageTitle } from '@/components/shared/PageTitle';
import { Container } from '@/components/shared/Container';
import { ChecklistTable } from '@/components/admin/ChecklistTable'; 
import type { Checklist, Vehicle } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangleIcon, ListChecksIcon, FilterIcon, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { getChecklistsForOperator } from '@/lib/services/checklistService';
import { getVehicles } from '@/lib/services/vehicleService';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ALL_ITEMS_VALUE = "all";

export default function OperatorAllChecklistsPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(undefined);

  const { data: operatorChecklists, isLoading: checklistsLoading, error: checklistsError } = useQuery<Checklist[], Error>({
    queryKey: ['operatorChecklists', currentUser?.id, selectedDate, selectedVehicleId],
    queryFn: () => getChecklistsForOperator(
      currentUser!.id,
      {
        date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined,
        vehicleId: selectedVehicleId,
      }
    ),
    enabled: !!currentUser,
  });

  const { data: vehiclesData, isLoading: vehiclesLoading, error: vehiclesError } = useQuery<Vehicle[], Error>({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
  });

  const isLoading = authLoading || checklistsLoading || vehiclesLoading;
  const queryError = checklistsError || vehiclesError;


  if (isLoading) {
    return (
        <Container>
            <PageTitle title="Meus Checklists Realizados" description="Carregando seus checklists..."/>
            <Card className="mb-6 shadow-md">
              <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
            <Skeleton className="h-64 w-full"/>
        </Container>
    );
  }

  if (!currentUser) {
    router.push('/');
    return <Container><Alert variant="destructive"><AlertTriangleIcon className="h-4 w-4" /><AlertTitle>Não Autenticado</AlertTitle><AlertDescription>Redirecionando para login...</AlertDescription></Alert></Container>;
  }

  if (queryError) {
      return <Container><Alert variant="destructive"><AlertTriangleIcon className="h-4 w-4" /><AlertTitle>Erro ao Carregar Dados</AlertTitle><AlertDescription>{checklistsError?.message || vehiclesError?.message}</AlertDescription></Alert></Container>;
  }


  return (
    <Container>
      <PageTitle
        title="Meus Checklists Realizados"
        description={`Visualize todos os checklists que você submeteu, ${currentUser.name}. Filtre por data ou veículo.`}
      />

      <Card className="mb-6 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center text-xl">
            <FilterIcon className="mr-2 h-5 w-5 text-primary" />
            Filtros de Busca
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="date-filter-op" className="mb-1 block text-sm font-medium text-muted-foreground">Data</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button id="date-filter-op" variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <span>{selectedDate ? format(selectedDate, 'PPP', { locale: ptBR }) : 'Selecione uma data'}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label htmlFor="vehicle-filter-op" className="mb-1 block text-sm font-medium text-muted-foreground">Veículo</label>
            <Select
              onValueChange={(value) => setSelectedVehicleId(value === ALL_ITEMS_VALUE ? undefined : value)}
              value={selectedVehicleId || ALL_ITEMS_VALUE}
            >
              <SelectTrigger id="vehicle-filter-op">
                <SelectValue placeholder="Todos os veículos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ITEMS_VALUE}>Todos os veículos</SelectItem>
                {vehiclesData?.map(v => <SelectItem key={v.id} value={v.id}>{v.plate} - {v.make} {v.model}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Placeholder for potential "Apply Filters" button or other actions */}
           <div className="flex items-end sm:col-span-2 lg:col-span-1">
            {/* <Button onClick={handleApplyFilters} className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
                <SearchIcon className="mr-2 h-4 w-4"/>
                Aplicar Filtros
            </Button> */}
          </div>
        </CardContent>
      </Card>


      {operatorChecklists && operatorChecklists.length > 0 && vehiclesData ? (
        <ChecklistTable checklists={operatorChecklists} vehicles={vehiclesData} isAdminView={false} />
      ) : (
        <div className="mt-10 text-center">
          <ListChecksIcon className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h3 className="text-xl font-semibold text-foreground">Nenhum Checklist Encontrado</h3>
          <p className="text-muted-foreground">
            Você ainda não submeteu nenhum checklist { (selectedDate || selectedVehicleId) ? 'para os filtros aplicados' : ''}.
          </p>
          <Button asChild className="mt-6">
            <Link href="/operator/dashboard">Voltar ao Dashboard</Link>
          </Button>
        </div>
      )}
    </Container>
  );
}

