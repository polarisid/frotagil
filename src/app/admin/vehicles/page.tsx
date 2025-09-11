
'use client';

import { PageTitle } from '@/components/shared/PageTitle';
import { Container } from '@/components/shared/Container';
import { VehicleTable } from '@/components/admin/VehicleTable';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircleIcon, SearchIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { getVehicles } from '@/lib/services/vehicleService';
import type { Vehicle } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export default function AdminVehiclesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<Vehicle['status'] | 'all'>('all');

  const { data: vehicles, isLoading, error } = useQuery<Vehicle[], Error>({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
  });

  const filteredVehicles = vehicles?.filter(
    (vehicle) => {
      const searchMatch = 
        vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.make.toLowerCase().includes(searchTerm.toLowerCase());
      
      const statusMatch = selectedStatus === 'all' || vehicle.status === selectedStatus;

      return searchMatch && statusMatch;
    }
  ) || [];


  if (isLoading) {
    return (
      <Container>
        <PageTitle title="Gerenciamento de Veículos" description="Carregando veículos..." />
        <Card className="mb-6 shadow">
          <CardContent className="p-4 flex gap-4">
            <Skeleton className="h-10 flex-grow" />
            <Skeleton className="h-10 w-48" />
          </CardContent>
        </Card>
        <Skeleton className="h-64 w-full" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <PageTitle title="Erro" description={`Não foi possível carregar os veículos: ${error.message}`} />
      </Container>
    );
  }

  return (
    <Container>
      <PageTitle
        title="Gerenciamento de Veículos"
        description="Adicione, edite ou remova veículos da sua frota."
        actions={
          <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link href="/admin/vehicles/new">
              <PlusCircleIcon className="mr-2 h-4 w-4" />
              Adicionar Veículo
            </Link>
          </Button>
        }
      />
      
      <Card className="mb-6 shadow">
        <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative flex-grow">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar por placa, modelo..." 
                      className="pl-10" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as Vehicle['status'] | 'all')}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Status</SelectItem>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                        <SelectItem value="maintenance">Em Manutenção</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>

      <VehicleTable vehicles={filteredVehicles} />
    </Container>
  );
}
