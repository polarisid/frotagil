
'use client'; 

import { ChecklistForm } from '@/components/operator/ChecklistForm';
import { Container } from '@/components/shared/Container';
import { PageTitle } from '@/components/shared/PageTitle';
import type { Vehicle, Checklist as ChecklistType } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangleIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getVehicleById } from '@/lib/services/vehicleService';
import { getChecklistById } from '@/lib/services/checklistService';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

export default function OperatorChecklistPage() {
  const params = useParams();
  const searchParamsHook = useSearchParams(); // Renamed from searchParams to avoid conflict
  const router = useRouter();

  const vehicleId = params.vehicleId as string;
  const checklistIdQuery = searchParamsHook.get('checklistId'); // Use .get()

  const { currentUser, loading: authLoading } = useAuth();

  const { data: vehicle, isLoading: vehicleLoading, error: vehicleError } = useQuery<Vehicle | null, Error>({
    queryKey: ['vehicle', vehicleId],
    queryFn: () => getVehicleById(vehicleId),
    enabled: !!vehicleId,
  });

  const { data: existingChecklist, isLoading: checklistLoading, error: checklistError } = useQuery<ChecklistType | null, Error>({
    queryKey: ['checklist', checklistIdQuery],
    queryFn: () => checklistIdQuery ? getChecklistById(checklistIdQuery) : null,
    enabled: !!checklistIdQuery,
  });
  
  if (authLoading || vehicleLoading || (checklistIdQuery && checklistLoading)) {
    return (
        <Container>
            <PageTitle title="Carregando Checklist..." />
            <Skeleton className="h-12 w-3/4 mb-4" />
            <Skeleton className="h-96 w-full" />
        </Container>
    );
  }

  if (!currentUser) {
    router.push('/'); // Redirect to login if not authenticated
    return <Container><Alert variant="destructive"><AlertTriangleIcon className="h-4 w-4" /><AlertTitle>Não Autenticado</AlertTitle><AlertDescription>Você precisa estar logado para acessar esta página.</AlertDescription></Alert></Container>;
  }
  
  if (vehicleError) {
    return <Container><Alert variant="destructive"><AlertTriangleIcon className="h-4 w-4" /><AlertTitle>Erro ao Carregar Veículo</AlertTitle><AlertDescription>{vehicleError.message}</AlertDescription></Alert></Container>;
  }
  if (checklistIdQuery && checklistError) {
     return <Container><Alert variant="destructive"><AlertTriangleIcon className="h-4 w-4" /><AlertTitle>Erro ao Carregar Checklist</AlertTitle><AlertDescription>{checklistError.message}</AlertDescription></Alert></Container>;
  }


  if (!vehicle) {
    return (
      <Container>
        <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Erro: Veículo Não Encontrado</AlertTitle>
          <AlertDescription>
            Veículo não encontrado. Por favor, verifique o ID do veículo ou volte para o dashboard.
          </AlertDescription>
          <Button asChild variant="link" className="mt-2">
            <Link href="/operator/dashboard">Voltar ao Dashboard</Link>
          </Button>
        </Alert>
      </Container>
    );
  }
  
  // If not viewing an existing checklist, verify vehicle assignment for new checklist
  if (!existingChecklist) {
    if (vehicle.assignedOperatorId !== currentUser.id) {
      return (
        <Container>
          <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertTitle>Acesso Negado</AlertTitle>
            <AlertDescription>
              Este veículo não está atribuído a você ou você não o selecionou no dashboard. 
              Por favor, pegue um veículo disponível no seu dashboard para iniciar um novo checklist.
            </AlertDescription>
            <Button asChild variant="link" className="mt-2">
              <Link href="/operator/dashboard">Voltar ao Dashboard</Link>
            </Button>
          </Alert>
        </Container>
      );
    }
  } else { // Viewing an existing checklist
    if (existingChecklist.operatorId !== currentUser.id) {
       return (
        <Container>
          <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertTitle>Acesso Negado</AlertTitle>
            <AlertDescription>
              Você não tem permissão para visualizar este checklist.
            </AlertDescription>
            <Button asChild variant="link" className="mt-2">
              <Link href="/operator/dashboard">Voltar ao Dashboard</Link>
            </Button>
          </Alert>
        </Container>
      );
    }
  }
  
  if (checklistIdQuery && !existingChecklist && !checklistLoading) { // Added !checklistLoading
     return (
      <Container>
        <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Erro: Checklist Não Encontrado</AlertTitle>
          <AlertDescription>
            Checklist não encontrado para este veículo.
          </AlertDescription>
           <Button asChild variant="link" className="mt-2">
            <Link href={`/operator/checklist/${vehicle.id}`}>Criar Novo Checklist</Link>
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-8">
       <PageTitle 
        title={existingChecklist ? `Detalhes do Checklist` : `Novo Checklist para ${vehicle.plate}`}
        description={existingChecklist ? 
          `Visualizando checklist de ${new Date(existingChecklist.date).toLocaleDateString('pt-BR')} para ${vehicle.make} ${vehicle.model}` : 
          `Preencha os itens abaixo para o veículo ${vehicle.make} ${vehicle.model}.`}
      />
      <ChecklistForm 
        vehicle={vehicle} 
        existingChecklist={existingChecklist || undefined} // Pass undefined if null 
        currentOperatorName={currentUser.name}
        currentOperatorId={currentUser.id}
      />
    </Container>
  );
}
