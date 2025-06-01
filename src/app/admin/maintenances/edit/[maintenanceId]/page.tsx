
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Container } from '@/components/shared/Container';
import { PageTitle } from '@/components/shared/PageTitle';
import { EditMaintenanceForm } from '@/components/admin/EditMaintenanceForm';
import type { Maintenance, Vehicle } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { getMaintenanceById } from '@/lib/services/maintenanceService';
import { getVehicles } from '@/lib/services/vehicleService';

export default function EditMaintenancePage() {
  const router = useRouter();
  const params = useParams();
  const maintenanceId = params.maintenanceId as string;

  const { data: maintenance, isLoading: maintenanceLoading, error: maintenanceError } = useQuery<Maintenance | null, Error>({
    queryKey: ['maintenance', maintenanceId],
    queryFn: () => getMaintenanceById(maintenanceId),
    enabled: !!maintenanceId,
  });

  const { data: vehicles, isLoading: vehiclesLoading, error: vehiclesError } = useQuery<Vehicle[], Error>({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
  });

  const handleFormSubmitSuccess = () => {
    router.push('/admin/maintenances');
  };

  const isLoading = maintenanceLoading || vehiclesLoading;
  const queryError = maintenanceError || vehiclesError;

  if (isLoading) {
    return (
        <Container>
            <PageTitle title="Carregando Manutenção..." description="Aguarde enquanto carregamos as informações da manutenção." />
            <div className="space-y-4 max-w-2xl mx-auto">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-1/4" />
            </div>
        </Container>
    );
  }
  
  if (queryError) {
    return (
      <Container>
        <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Erro ao Carregar Dados</AlertTitle>
          <AlertDescription>
            {queryError.message || "Não foi possível carregar os dados para editar a manutenção."}
          </AlertDescription>
          <Button asChild variant="link" className="mt-4">
            <Link href="/admin/maintenances">Voltar para Lista de Manutenções</Link>
          </Button>
        </Alert>
      </Container>
    );
  }


  if (!maintenance || !vehicles) { // Ensure vehicles are also loaded
    return (
      <Container>
        <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Erro: Manutenção ou Veículos Não Encontrados</AlertTitle>
          <AlertDescription>
            A manutenção que você está tentando editar não foi encontrada ou os dados dos veículos não puderam ser carregados. 
            Por favor, verifique o ID ou retorne à lista de manutenções.
          </AlertDescription>
          <Button asChild variant="link" className="mt-4">
            <Link href="/admin/maintenances">Voltar para Lista de Manutenções</Link>
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container>
      <PageTitle
        title={`Editar Manutenção: ${maintenance.description.substring(0,30)}...`}
        description={`Atualize as informações da manutenção para o veículo ${vehicles.find(v=>v.id === maintenance.vehicleId)?.plate}.`}
      />
      <EditMaintenanceForm
        maintenance={maintenance}
        vehicles={vehicles}
        onFormSubmitSuccess={handleFormSubmitSuccess}
      />
    </Container>
  );
}
