
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Container } from '@/components/shared/Container';
import { PageTitle } from '@/components/shared/PageTitle';
import { EditChecklistForm } from '@/components/admin/EditChecklistForm';
import type { Checklist, Vehicle } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { getChecklistById } from '@/lib/services/checklistService';
import { getVehicleById } from '@/lib/services/vehicleService';

export default function EditChecklistPage() {
  const router = useRouter();
  const params = useParams();
  const checklistId = params.checklistId as string;

  const { data: checklist, isLoading: checklistLoading, error: checklistError } = useQuery<Checklist | null, Error>({
    queryKey: ['checklist', checklistId],
    queryFn: () => getChecklistById(checklistId),
    enabled: !!checklistId,
  });

  const { data: vehicle, isLoading: vehicleLoading, error: vehicleError } = useQuery<Vehicle | null, Error>({
    queryKey: ['vehicle', checklist?.vehicleId],
    queryFn: () => getVehicleById(checklist!.vehicleId),
    enabled: !!checklist?.vehicleId,
  });
  
  const handleFormSubmitSuccess = () => {
    router.push('/admin/checklists');
  };

  const isLoading = checklistLoading || vehicleLoading;
  const queryError = checklistError || vehicleError;

  if (isLoading) {
    return (
      <Container>
        <PageTitle title="Carregando Checklist..." description="Aguarde enquanto carregamos os detalhes do checklist." />
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
            {queryError.message || "Não foi possível carregar os dados para editar o checklist."}
          </AlertDescription>
          <Button asChild variant="link" className="mt-4">
            <Link href="/admin/checklists">Voltar para a Lista</Link>
          </Button>
        </Alert>
      </Container>
    );
  }

  if (!checklist || !vehicle) {
    return (
      <Container>
        <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Erro: Checklist ou Veículo Não Encontrado</AlertTitle>
          <AlertDescription>
            Os dados que você está tentando editar não foram encontrados.
          </AlertDescription>
          <Button asChild variant="link" className="mt-4">
            <Link href="/admin/checklists">Voltar para a Lista</Link>
          </Button>
        </Alert>
      </Container>
    );
  }


  return (
    <Container>
      <PageTitle
        title={`Editar Checklist #${checklist.id.substring(0, 8)}`}
        description={`Alterando dados para o veículo ${vehicle.plate} (Operador: ${checklist.operatorName}).`}
      />
      <EditChecklistForm
        checklist={checklist}
        vehicle={vehicle}
        onFormSubmitSuccess={handleFormSubmitSuccess}
      />
    </Container>
  );
}
