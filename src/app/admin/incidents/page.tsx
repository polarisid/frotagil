
'use client';

import { PageTitle } from '@/components/shared/PageTitle';
import { Container } from '@/components/shared/Container';
import { IncidentTable } from '@/components/admin/IncidentTable';
import type { Incident, Vehicle as VehicleType, User } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FilterIcon, SearchIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getIncidents } from '@/lib/services/incidentService';
import { getVehicles } from '@/lib/services/vehicleService';
import { getUsers } from '@/lib/services/userService';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';

const ALL_ITEMS_VALUE = "all"; // Constant for "all" select item value

export default function AdminIncidentsPage() {
  const [searchDescription, setSearchDescription] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);


  const { data: incidentsData, isLoading: incidentsLoading, error: incidentsError } = useQuery<Incident[], Error>({
    queryKey: ['incidents', selectedVehicleId, selectedStatus],
    queryFn: () => getIncidents({ vehicleId: selectedVehicleId, status: selectedStatus }),
  });

  const { data: vehiclesData, isLoading: vehiclesLoading, error: vehiclesError } = useQuery<VehicleType[], Error>({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
  });
  
  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery<User[], Error>({
    queryKey: ['users'],
    queryFn: getUsers, // To map operatorId to name if needed, though incident has operatorName
  });


  const filteredIncidents = incidentsData?.filter(inc => 
    inc.description.toLowerCase().includes(searchDescription.toLowerCase())
  ) || [];

  const isLoading = incidentsLoading || vehiclesLoading || usersLoading;
  const queryError = incidentsError || vehiclesError || usersError;

  if (isLoading) {
    return (
      <Container>
        <PageTitle title="Sinistros e Ocorrências" description="Carregando ocorrências..." />
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
        title="Sinistros e Ocorrências"
        description="Visualize e gerencie todos os sinistros e ocorrências reportados para os veículos da frota."
      />

      <Card className="mb-6 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center text-xl">
            <FilterIcon className="mr-2 h-5 w-5 text-primary" />
            Filtros de Busca
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input 
            placeholder="Buscar por descrição..." 
            value={searchDescription}
            onChange={(e) => setSearchDescription(e.target.value)}
          />
          
          <div>
            <label htmlFor="vehicle-filter" className="mb-1 block text-sm font-medium text-muted-foreground">Veículo</label>
            <Select
              onValueChange={(value) => setSelectedVehicleId(value === ALL_ITEMS_VALUE ? undefined : value)}
              value={selectedVehicleId}
            >
              <SelectTrigger id="vehicle-filter">
                <SelectValue placeholder="Todos os veículos" />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value={ALL_ITEMS_VALUE}>Todos os veículos</SelectItem>
                {vehiclesData?.map(v => <SelectItem key={v.id} value={v.id}>{v.plate} - {v.make} {v.model}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
             <label htmlFor="status-filter" className="mb-1 block text-sm font-medium text-muted-foreground">Status</label>
            <Select
              onValueChange={(value) => setSelectedStatus(value === ALL_ITEMS_VALUE ? undefined : value)}
              value={selectedStatus}
            >
              <SelectTrigger id="status-filter">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value={ALL_ITEMS_VALUE}>Todos os status</SelectItem>
                <SelectItem value="reported">Reportado</SelectItem>
                <SelectItem value="under_analysis">Em Análise</SelectItem>
                <SelectItem value="pending_action">Ação Pendente</SelectItem>
                <SelectItem value="resolved">Resolvido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-end">
            {/* <Button className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
                <SearchIcon className="mr-2 h-4 w-4"/>
                Aplicar Filtros
            </Button> */}
          </div>
        </CardContent>
      </Card>

      <IncidentTable incidents={filteredIncidents} vehicles={vehiclesData || []} users={usersData || []} />
    </Container>
  );
}
