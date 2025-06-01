
'use client';

import { PageTitle } from '@/components/shared/PageTitle';
import { Container } from '@/components/shared/Container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircleIcon, SearchIcon, FilterIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { MaintenanceTable } from '@/components/admin/MaintenanceTable';
import type { Maintenance, Vehicle as VehicleType } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { getMaintenances } from '@/lib/services/maintenanceService';
import { getVehicles } from '@/lib/services/vehicleService';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';

const ALL_ITEMS_VALUE = "all"; // Constant for "all" select item value

export default function AdminMaintenancesPage() {
  const [searchDescription, setSearchDescription] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);

  const { data: maintenancesData, isLoading: maintenancesLoading, error: maintenancesError } = useQuery<Maintenance[], Error>({
    queryKey: ['maintenances', selectedVehicleId, selectedStatus], // Add filters to queryKey
    queryFn: () => getMaintenances({ vehicleId: selectedVehicleId, status: selectedStatus }),
  });

  const { data: vehiclesData, isLoading: vehiclesLoading, error: vehiclesError } = useQuery<VehicleType[], Error>({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
  });

  const filteredMaintenances = maintenancesData?.filter(maint => 
    maint.description.toLowerCase().includes(searchDescription.toLowerCase())
  ) || [];

  const isLoading = maintenancesLoading || vehiclesLoading;
  const queryError = maintenancesError || vehiclesError;

  if (isLoading) {
    return (
      <Container>
        <PageTitle title="Gerenciamento de Manutenções" description="Carregando manutenções..." />
        <Card className="mb-6 shadow-md">
          <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
             {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </CardContent>
        </Card>
        <Skeleton className="h-64 w-full" />
      </Container>
    );
  }

  if (queryError) {
    return <Container><PageTitle title="Erro" description={`Não foi possível carregar os dados: ${queryError.message}`} /></Container>;
  }


  return (
    <Container>
      <PageTitle
        title="Gerenciamento de Manutenções"
        description="Visualize, adicione ou edite as manutenções dos veículos da frota."
        actions={
          <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link href="/admin/maintenances/new"> 
              <PlusCircleIcon className="mr-2 h-4 w-4" />
              Agendar Manutenção
            </Link>
          </Button>
        }
      />
      
      <Card className="mb-6 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center text-xl">
            <FilterIcon className="mr-2 h-5 w-5 text-primary" />
            Filtros de Manutenção
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input 
            placeholder="Buscar por descrição..." 
            value={searchDescription}
            onChange={(e) => setSearchDescription(e.target.value)}
          />
           <div>
            <label htmlFor="vehicle-filter-maint" className="mb-1 block text-sm font-medium text-muted-foreground">Veículo</label>
            <Select
              onValueChange={(value) => setSelectedVehicleId(value === ALL_ITEMS_VALUE ? undefined : value)}
              value={selectedVehicleId} // Let placeholder show if undefined
            >
              <SelectTrigger id="vehicle-filter-maint">
                <SelectValue placeholder="Todos os veículos" />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value={ALL_ITEMS_VALUE}>Todos os veículos</SelectItem>
                {vehiclesData?.map(v => <SelectItem key={v.id} value={v.id}>{v.plate} - {v.make} {v.model}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
           <div>
            <label htmlFor="status-filter-maint" className="mb-1 block text-sm font-medium text-muted-foreground">Status</label>
            <Select
              onValueChange={(value) => setSelectedStatus(value === ALL_ITEMS_VALUE ? undefined : value)}
              value={selectedStatus} // Let placeholder show if undefined
            >
              <SelectTrigger id="status-filter-maint">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value={ALL_ITEMS_VALUE}>Todos os status</SelectItem>
                <SelectItem value="planned">Planejada</SelectItem>
                <SelectItem value="in_progress">Em Progresso</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            {/* <Button className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
                <SearchIcon className="mr-2 h-4 w-4"/>
                Aplicar Filtros 
            </Button> */} 
            {/* Filters are applied on change via queryKey */}
          </div>
        </CardContent>
      </Card>

      <MaintenanceTable maintenances={filteredMaintenances} vehicles={vehiclesData || []} />
    </Container>
  );
}
