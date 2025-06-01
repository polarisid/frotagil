
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Container } from '@/components/shared/Container';
import { PageTitle } from '@/components/shared/PageTitle';
import { EditVehicleForm } from '@/components/admin/EditVehicleForm';
import type { Vehicle } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { getVehicleById } from '@/lib/services/vehicleService';

export default function EditVehiclePage() {
  const router = useRouter();
  const params = useParams();
  const vehicleId = params.vehicleId as string;

  const { data: vehicle, isLoading, error } = useQuery<Vehicle | null, Error>({
    queryKey: ['vehicle', vehicleId],
    queryFn: () => getVehicleById(vehicleId),
    enabled: !!vehicleId, // only run if vehicleId is available
  });

  const handleFormSubmitSuccess = () => {
    router.push('/admin/vehicles');
  };

  if (isLoading) {
    return (
        <Container>
            <PageTitle title="Carregando Veículo..." description="Aguarde enquanto carregamos as informações do veículo." />
            <div className="space-y-4 max-w-2xl mx-auto">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-10 w-1/4" />
            </div>
        </Container>
    );
  }

  if (error) {
     return (
      <Container>
        <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Erro ao Carregar Veículo</AlertTitle>
          <AlertDescription>
            {error.message || "Não foi possível carregar os dados do veículo."}
          </AlertDescription>
          <Button asChild variant="link" className="mt-4">
            <Link href="/admin/vehicles">Voltar para Lista de Veículos</Link>
          </Button>
        </Alert>
      </Container>
    );
  }

  if (!vehicle) {
    return (
      <Container>
        <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Erro: Veículo Não Encontrado</AlertTitle>
          <AlertDescription>
            O veículo que você está tentando editar não foi encontrado. 
            Por favor, verifique o ID do veículo ou retorne à lista de veículos.
          </AlertDescription>
          <Button asChild variant="link" className="mt-4">
            <Link href="/admin/vehicles">Voltar para Lista de Veículos</Link>
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container>
      <PageTitle
        title={`Editar Veículo: ${vehicle.plate}`}
        description={`Atualize as informações do veículo ${vehicle.make} ${vehicle.model}.`}
      />
      <EditVehicleForm
        vehicle={vehicle}
        onFormSubmitSuccess={handleFormSubmitSuccess}
      />
    </Container>
  );
}
