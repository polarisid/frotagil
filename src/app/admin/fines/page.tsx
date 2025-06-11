
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PageTitle } from '@/components/shared/PageTitle';
import { Container } from '@/components/shared/Container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PlusCircleIcon, FilterIcon, SearchIcon, AlertTriangleIcon, ReceiptTextIcon } from 'lucide-react';
import type { Fine, User, Vehicle } from '@/lib/types';
import { getFines } from '@/lib/services/fineService';
import { getUsers } from '@/lib/services/userService';
import { getVehicles } from '@/lib/services/vehicleService';
import { FineTable } from '@/components/admin/FineTable';

const ALL_ITEMS_VALUE = "all";

export default function AdminFinesPage() {
  const [searchDescription, setSearchDescription] = useState('');
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | undefined>(undefined);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<Fine['status'] | undefined>(undefined);

  const { data: finesData, isLoading: finesLoading, error: finesError } = useQuery<Fine[], Error>({
    queryKey: ['fines', selectedOperatorId, selectedVehicleId, selectedStatus, searchDescription], // searchDescription added to re-trigger if it changes. Filtering happens client-side for now.
    queryFn: () => getFines({
      operatorId: selectedOperatorId === ALL_ITEMS_VALUE ? undefined : selectedOperatorId,
      vehicleId: selectedVehicleId === ALL_ITEMS_VALUE ? undefined : selectedVehicleId,
      status: selectedStatus === ALL_ITEMS_VALUE ? undefined : selectedStatus,
    }),
  });

  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery<User[], Error>({
    queryKey: ['users'],
    queryFn: getUsers,
  });

  const { data: vehiclesData, isLoading: vehiclesLoading, error: vehiclesError } = useQuery<Vehicle[], Error>({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
  });

  const operators = usersData?.filter(u => u.role === 'operator') || [];

  const filteredFines = finesData?.filter(fine =>
    fine.description.toLowerCase().includes(searchDescription.toLowerCase()) ||
    fine.infractionCode.toLowerCase().includes(searchDescription.toLowerCase()) ||
    fine.location.toLowerCase().includes(searchDescription.toLowerCase())
  ) || [];

  const isLoadingOverall = finesLoading || usersLoading || vehiclesLoading;
  const queryError = finesError || usersError || vehiclesError;

  if (isLoadingOverall) {
    return (
      <Container>
        <PageTitle title="Gerenciamento de Multas" description="Carregando multas..." />
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
    return <Container><PageTitle title="Erro ao Carregar Dados" description={queryError.message} /></Container>;
  }

  return (
    <Container>
      <PageTitle
        title="Gerenciamento de Multas"
        description="Cadastre, visualize e gerencie as multas de trânsito da frota."
        icon={<ReceiptTextIcon className="mr-2 h-6 w-6 text-primary" />}
        actions={
          <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link href="/admin/fines/new">
              <PlusCircleIcon className="mr-2 h-4 w-4" /> Cadastrar Nova Multa
            </Link>
          </Button>
        }
      />

      <Card className="mb-6 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center text-xl">
            <FilterIcon className="mr-2 h-5 w-5 text-primary" /> Filtros de Busca
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Buscar por código, descrição, local..."
            value={searchDescription}
            onChange={(e) => setSearchDescription(e.target.value)}
          />
          <Select
            onValueChange={(value) => setSelectedOperatorId(value)}
            value={selectedOperatorId || ALL_ITEMS_VALUE}
          >
            <SelectTrigger><SelectValue placeholder="Todos os Operadores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ITEMS_VALUE}>Todos os Operadores</SelectItem>
              {operators.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) => setSelectedVehicleId(value)}
            value={selectedVehicleId || ALL_ITEMS_VALUE}
          >
            <SelectTrigger><SelectValue placeholder="Todos os Veículos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ITEMS_VALUE}>Todos os Veículos</SelectItem>
              {vehiclesData?.map(v => <SelectItem key={v.id} value={v.id}>{v.plate} - {v.make} {v.model}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) => setSelectedStatus(value as Fine['status'] | undefined)}
            value={selectedStatus || ALL_ITEMS_VALUE}
          >
            <SelectTrigger><SelectValue placeholder="Todos os Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ITEMS_VALUE}>Todos os Status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="paid">Paga</SelectItem>
              <SelectItem value="appealed">Recorrida</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {filteredFines.length > 0 ? (
        <FineTable fines={filteredFines} users={usersData || []} vehicles={vehiclesData || []} />
      ) : (
        <Alert>
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Nenhuma Multa Encontrada</AlertTitle>
          <AlertDescription>
            Não foram encontradas multas para os filtros aplicados ou nenhuma multa foi cadastrada ainda.
          </AlertDescription>
        </Alert>
      )}
    </Container>
  );
}
