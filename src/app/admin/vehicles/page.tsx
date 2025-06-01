
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

export default function AdminVehiclesPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: vehicles, isLoading, error } = useQuery<Vehicle[], Error>({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
  });

  const filteredVehicles = vehicles?.filter(
    (vehicle) =>
      vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.make.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];


  if (isLoading) {
    return (
      <Container>
        <PageTitle title="Gerenciamento de Veículos" description="Carregando veículos..." />
        <Card className="mb-6 shadow">
          <CardContent className="p-4">
            <Skeleton className="h-10 w-full" />
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
            <div className="flex items-center gap-4">
                <div className="relative flex-grow">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar por placa, modelo..." 
                      className="pl-10" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {/* <Button variant="outline">Buscar</Button> Search is now live */}
            </div>
        </CardContent>
      </Card>

      <VehicleTable vehicles={filteredVehicles} />
    </Container>
  );
}
