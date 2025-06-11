
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Container } from '@/components/shared/Container';
import { PageTitle } from '@/components/shared/PageTitle';
import { EditFineForm } from '@/components/admin/EditFineForm';
import type { Fine, User, Vehicle } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { getFineById } from '@/lib/services/fineService';
import { getUsers } from '@/lib/services/userService';
import { getVehicles } from '@/lib/services/vehicleService';

export default function EditFinePage() {
  const router = useRouter();
  const params = useParams();
  const fineId = params.fineId as string;

  const { data: fine, isLoading: fineLoading, error: fineError } = useQuery<Fine | null, Error>({
    queryKey: ['fine', fineId],
    queryFn: () => getFineById(fineId),
    enabled: !!fineId,
  });

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

  const isLoading = fineLoading || usersLoading || vehiclesLoading;
  const queryError = fineError || usersError || vehiclesError;

  if (isLoading) {
    return (
      <Container>
        <PageTitle title="Carregando Multa..." description="Aguarde enquanto carregamos as informações da multa." />
        <Skeleton className="h-96 w-full max-w-2xl mx-auto" />
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
            {queryError.message || "Não foi possível carregar os dados para editar a multa."}
          </AlertDescription>
          <Button asChild variant="link" className="mt-4">
            <Link href="/admin/fines">Voltar para Lista de Multas</Link>
          </Button>
        </Alert>
      </Container>
    );
  }

  if (!fine || !users || !vehicles) {
    return (
      <Container>
        <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Erro: Multa ou Dados Auxiliares Não Encontrados</AlertTitle>
          <AlertDescription>
            A multa que você está tentando editar não foi encontrada ou os dados de usuários/veículos não puderam ser carregados.
          </AlertDescription>
          <Button asChild variant="link" className="mt-4">
            <Link href="/admin/fines">Voltar para Lista de Multas</Link>
          </Button>
        </Alert>
      </Container>
    );
  }
  
  // Ensure only pending fines can be edited via this route
  if (fine.status !== 'pending') {
    return (
      <Container>
        <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Ação Não Permitida</AlertTitle>
          <AlertDescription>
            Esta multa não está com status "Pendente" e não pode mais ser editada por este formulário.
          </AlertDescription>
          <Button asChild variant="link" className="mt-4">
            <Link href="/admin/fines">Voltar para Lista de Multas</Link>
          </Button>
        </Alert>
      </Container>
    );
  }


  return (
    <Container>
      <PageTitle
        title={`Editar Multa #${fine.id.substring(0, 8)}`}
        description={`Atualize os detalhes da multa para o veículo ${fine.vehiclePlate}, operador ${fine.operatorName}.`}
      />
      <EditFineForm
        fine={fine}
        operators={users.filter(u => u.role === 'operator')} // Pass only operators
        vehicles={vehicles}
        onFormSubmitSuccess={handleFormSubmitSuccess}
      />
    </Container>
  );
}
