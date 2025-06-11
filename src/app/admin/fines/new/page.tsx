
'use client';

import { Container } from '@/components/shared/Container';
import { PageTitle } from '@/components/shared/PageTitle';
import { NewFineForm } from '@/components/admin/NewFineForm';
import type { User, Vehicle } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getUsers } from '@/lib/services/userService';
import { getVehicles } from '@/lib/services/vehicleService';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangleIcon } from 'lucide-react';

export default function NewFinePage() {
  const router = useRouter();

  const { data: users, isLoading: usersLoading, error: usersError } = useQuery<User[], Error>({
    queryKey: ['users'],
    queryFn: getUsers,
  });

  const { data: vehicles, isLoading: vehiclesLoading, error: vehiclesError } = useQuery<Vehicle[], Error>({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
  });

  const handleFormSubmitSuccess = () => {
    router.push('/admin/fines');
  };

  const isLoading = usersLoading || vehiclesLoading;
  const queryError = usersError || vehiclesError;

  if (isLoading) {
    return (
      <Container>
        <PageTitle title="Cadastrar Nova Multa" description="Carregando dados..." />
        <Skeleton className="h-96 w-full max-w-2xl mx-auto" />
      </Container>
    );
  }

  if (queryError || !users || !vehicles) {
    return (
      <Container>
         <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Erro ao Carregar Dados</AlertTitle>
          <AlertDescription>
            {queryError?.message || "Não foi possível carregar os dados necessários para cadastrar a multa."}
          </AlertDescription>
        </Alert>
      </Container>
    );
  }
  
  const activeOperators = users.filter(u => u.role === 'operator' && u.status === 'active');
  const activeVehicles = vehicles.filter(v => v.status === 'active' || v.status === 'maintenance');


  return (
    <Container>
      <PageTitle
        title="Cadastrar Nova Multa"
        description="Preencha os detalhes abaixo para registrar uma nova multa."
      />
      <NewFineForm
        operators={activeOperators}
        vehicles={activeVehicles}
        onFormSubmitSuccess={handleFormSubmitSuccess}
      />
    </Container>
  );
}
