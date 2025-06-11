
'use client';

import { useQuery } from '@tanstack/react-query';
import { PageTitle } from '@/components/shared/PageTitle';
import { Container } from '@/components/shared/Container';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangleIcon, ReceiptTextIcon } from 'lucide-react';
import type { Fine } from '@/lib/types';
import { getFinesByOperatorId } from '@/lib/services/fineService';
import { useAuth } from '@/hooks/useAuth';
import { OperatorFineTable } from '@/components/operator/OperatorFineTable'; // Assuming this component will be created
import { useRouter } from 'next/navigation';

export default function OperatorFinesPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const { data: fines, isLoading: finesLoading, error: finesError } = useQuery<Fine[], Error>({
    queryKey: ['operatorFines', currentUser?.id],
    queryFn: () => currentUser ? getFinesByOperatorId(currentUser.id) : Promise.resolve([]),
    enabled: !!currentUser,
  });

  const isLoading = authLoading || finesLoading;

  if (isLoading) {
    return (
      <Container>
        <PageTitle title="Minhas Multas" description="Carregando suas multas..." />
        <Skeleton className="h-64 w-full" />
      </Container>
    );
  }

  if (!currentUser) {
    router.push('/'); // Redirect if not logged in
    return <Container><PageTitle title="Acesso Negado" description="Você precisa estar logado."/></Container>;
  }
  
  if (finesError) {
    return (
      <Container>
        <Alert variant="destructive">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Erro ao Carregar Multas</AlertTitle>
          <AlertDescription>{finesError.message}</AlertDescription>
        </Alert>
      </Container>
    );
  }

  return (
    <Container>
      <PageTitle
        title="Minhas Multas"
        description={`Olá ${currentUser.name}, aqui estão as multas registradas em seu nome.`}
        icon={<ReceiptTextIcon className="mr-2 h-6 w-6 text-primary" />}
      />
      {fines && fines.length > 0 ? (
        <OperatorFineTable fines={fines} />
      ) : (
        <Alert>
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Nenhuma Multa Encontrada</AlertTitle>
          <AlertDescription>
            Você não possui nenhuma multa registrada no sistema.
          </AlertDescription>
        </Alert>
      )}
    </Container>
  );
}
