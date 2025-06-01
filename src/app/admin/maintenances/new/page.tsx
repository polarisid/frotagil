
'use client';

import { Container } from '@/components/shared/Container';
import { PageTitle } from '@/components/shared/PageTitle';
import { NewMaintenanceForm } from '@/components/admin/NewMaintenanceForm';
import type { Vehicle } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getVehicles } from '@/lib/services/vehicleService';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangleIcon } from 'lucide-react';


export default function NewMaintenancePage() {
  const router = useRouter();

  const { data: vehicles, isLoading, error } = useQuery<Vehicle[], Error>({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
  });


  const handleFormSubmitSuccess = () => {
    router.push('/admin/maintenances');
  };

  if (isLoading) {
    return (
      <Container>
        <PageTitle title="Agendar Nova Manutenção" description="Carregando dados..." />
        <Skeleton className="h-96 w-full max-w-2xl mx-auto" />
      </Container>
    );
  }

  if (error || !vehicles) {
    return (
      <Container>
         <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Erro ao Carregar Dados</AlertTitle>
          <AlertDescription>
            {error?.message || "Não foi possível carregar os veículos necessários para agendar a manutenção."}
          </AlertDescription>
        </Alert>
      </Container>
    );
  }


  return (
    <Container>
      <PageTitle
        title="Agendar Nova Manutenção"
        description="Preencha os detalhes abaixo para agendar uma nova manutenção para um veículo da frota."
      />
      <NewMaintenanceForm
        vehicles={vehicles}
        onFormSubmitSuccess={handleFormSubmitSuccess}
      />
    </Container>
  );
}
