
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react'; // Import useEffect
import { Container } from '@/components/shared/Container';
import { PageTitle } from '@/components/shared/PageTitle';
import type { Checklist, Vehicle, User, ChecklistItem as ChecklistItemType } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AlertTriangleIcon, CheckCircle2Icon, XCircleIcon, CalendarIcon, UserIcon, TruckIcon, FileTextIcon, GaugeIcon, MinusCircleIcon, RouteIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { getChecklistById } from '@/lib/services/checklistService';
import { getVehicleById } from '@/lib/services/vehicleService';
import { getUserById } from '@/lib/services/userService';
import { useAuth } from '@/hooks/useAuth';

const ChecklistItemDisplay = ({ item }: { item: ChecklistItemType }) => (
  <TableRow>
    <TableCell>{item.label}</TableCell>
    <TableCell className="text-right">
      {item.value === true && <CheckCircle2Icon className="h-5 w-5 text-green-500 inline" aria-label="Sim" />}
      {item.value === false && <XCircleIcon className="h-5 w-5 text-red-500 inline" aria-label="Não" />}
      {item.value === null && <MinusCircleIcon className="h-5 w-5 text-muted-foreground inline" aria-label="N/A" />}
    </TableCell>
  </TableRow>
);


export default function AdminViewChecklistPage() {
  const params = useParams();
  const router = useRouter();
  const checklistId = params.checklistId as string;
  const { currentUser, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && (!currentUser || currentUser.role !== 'admin')) {
      router.push('/'); // Redirect to login or a "not authorized" page
    }
  }, [authLoading, currentUser, router]);

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

  const { data: operator, isLoading: operatorLoading, error: operatorError } = useQuery<User | null, Error>({
    queryKey: ['user', checklist?.operatorId],
    queryFn: () => getUserById(checklist!.operatorId),
    enabled: !!checklist?.operatorId,
  });

  if (authLoading || checklistLoading || (checklist && (vehicleLoading || operatorLoading)) ) {
    return (
        <Container>
            <PageTitle title="Carregando Checklist..." />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                    <Skeleton className="h-12 w-1/2" />
                    <Skeleton className="h-40 w-full" />
                </div>
                <div className="space-y-6">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            </div>
            <Skeleton className="h-24 w-full mt-6" />
            <Skeleton className="h-20 w-full mt-6" />
        </Container>
    );
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return <Container><Alert variant="destructive"><AlertDescription>Acesso não autorizado. Redirecionando...</AlertDescription></Alert></Container>;
  }
  
  const queryError = checklistError || vehicleError || operatorError;
  if (queryError) {
    return (
      <Container>
        <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Erro ao Carregar Dados</AlertTitle>
          <AlertDescription>
            {queryError.message || "Não foi possível carregar os detalhes do checklist."}
          </AlertDescription>
          <Button asChild variant="link" className="mt-4">
            <Link href="/admin/checklists">Voltar para Lista de Checklists</Link>
          </Button>
        </Alert>
      </Container>
    );
  }


  if (!checklist) {
    return (
      <Container>
        <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Erro: Checklist Não Encontrado</AlertTitle>
          <AlertDescription>
            O checklist que você está tentando visualizar não foi encontrado.
          </AlertDescription>
          <Button asChild variant="link" className="mt-4">
            <Link href="/admin/checklists">Voltar para Lista de Checklists</Link>
          </Button>
        </Alert>
      </Container>
    );
  }

  const vehicleInfo = vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.plate})` : 'Veículo Desconhecido';
  const operatorNameDisplay = operator?.name || checklist.operatorName || 'Operador Desconhecido';

  return (
    <Container>
      <PageTitle
        title={`Detalhes do Checklist #${checklist.id.substring(0, 8)}`}
        description={`Visualizando checklist submetido por ${operatorNameDisplay} para o veículo ${vehicleInfo}.`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center"><FileTextIcon className="mr-2 h-5 w-5 text-primary" />Itens Verificados</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checklist.items.map(item => <ChecklistItemDisplay key={item.id} item={item} />)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
            <Card className="shadow-md">
                <CardHeader>
                <CardTitle className="flex items-center"><TruckIcon className="mr-2 h-5 w-5 text-primary" />Veículo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                <p><strong>Placa:</strong> {vehicle?.plate || 'N/A'}</p>
                <p><strong>Modelo:</strong> {vehicle?.make || 'N/A'} {vehicle?.model || 'N/A'}</p>
                <p><strong>Ano:</strong> {vehicle?.year || 'N/A'}</p>
                {checklist.mileage !== undefined && (
                    <p className="flex items-center">
                        <GaugeIcon className="mr-1 h-4 w-4 text-muted-foreground" />
                        <strong>KM Registrado:</strong> {checklist.mileage.toLocaleString('pt-BR')} km
                    </p>
                )}
                </CardContent>
            </Card>

            <Card className="shadow-md">
                <CardHeader>
                <CardTitle className="flex items-center"><UserIcon className="mr-2 h-5 w-5 text-primary" />Operador</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                <p><strong>Nome:</strong> {operatorNameDisplay}</p>
                <p><strong>ID do Operador:</strong> {checklist.operatorId}</p>
                <p className="flex items-center">
                    <CalendarIcon className="mr-1 h-4 w-4 text-muted-foreground" />
                    <strong>Data:</strong> {format(new Date(checklist.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
                </CardContent>
            </Card>

            {checklist.routeDescription && (
              <Card className="shadow-md">
                  <CardHeader>
                      <CardTitle className="flex items-center"><RouteIcon className="mr-2 h-5 w-5 text-primary" />Descrição da Rota</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <p className="text-sm">{checklist.routeDescription}</p>
                  </CardContent>
              </Card>
            )}
        </div>
      </div>

        {checklist.observations && (
            <Card className="mt-6 shadow-md">
                <CardHeader>
                    <CardTitle>Observações do Operador</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{checklist.observations}</p>
                </CardContent>
            </Card>
        )}

        <Card className="mt-6 shadow-md">
            <CardHeader>
                <CardTitle>Assinatura Digital</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-lg font-medium font-mono p-4 border rounded-md bg-secondary/50">{checklist.signature}</p>
            </CardContent>
        </Card>

        <div className="mt-8 text-center">
            <Button asChild variant="default">
                <Link href="/admin/checklists">Voltar para Lista de Checklists</Link>
            </Button>
             <Button onClick={() => router.back()} variant="outline" className="ml-4">Voltar</Button>
        </div>

    </Container>
  );
}

