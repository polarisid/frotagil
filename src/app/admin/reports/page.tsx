
'use client';

import { useQuery } from '@tanstack/react-query';
import { PageTitle } from '@/components/shared/PageTitle';
import { Container } from '@/components/shared/Container';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangleIcon, BarChart3Icon, UsersIcon, TruckIcon, CalendarDaysIcon, CalendarRangeIcon, ListChecksIcon, CalendarIcon as CalendarFilterIcon } from 'lucide-react';
import { getOperatorPerformanceReport, getVehicleMileageReport } from '@/lib/services/reportService';
import type { OperatorPerformanceReportItem, VehicleMileageReportItem } from '@/lib/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminReportsPage() {
  const [reportReferenceDate, setReportReferenceDate] = useState<Date>(new Date());

  const { data: operatorPerformance, isLoading: operatorLoading, error: operatorError } = useQuery<OperatorPerformanceReportItem[], Error>({
    queryKey: ['operatorPerformanceReport', reportReferenceDate.toISOString().split('T')[0]],
    queryFn: () => getOperatorPerformanceReport(reportReferenceDate),
  });

  const { data: vehicleMileage, isLoading: vehicleLoading, error: vehicleError } = useQuery<VehicleMileageReportItem[], Error>({
    queryKey: ['vehicleMileageReport', reportReferenceDate.toISOString().split('T')[0]],
    queryFn: () => getVehicleMileageReport(reportReferenceDate),
  });

  const isLoading = operatorLoading || vehicleLoading;
  const queryError = operatorError || vehicleError;

  const selectedWeekStart = startOfWeek(reportReferenceDate, { locale: ptBR, weekStartsOn: 1 });
  const selectedWeekEnd = endOfWeek(reportReferenceDate, { locale: ptBR, weekStartsOn: 1 });
  const selectedMonth = format(reportReferenceDate, "MMMM 'de' yyyy", { locale: ptBR });


  if (isLoading) {
    return (
      <Container>
        <PageTitle title="Relatórios Gerenciais" description="Carregando dados dos relatórios..." />
        <div className="mb-6">
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card><CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
        </div>
      </Container>
    );
  }

  if (queryError) {
    return (
      <Container>
        <Alert variant="destructive">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Erro ao Carregar Relatórios</AlertTitle>
          <AlertDescription>{queryError.message}</AlertDescription>
        </Alert>
      </Container>
    );
  }

  return (
    <Container>
      <PageTitle
        title="Relatórios Gerenciais"
        description={
          <>
            Visão geral da performance dos motoristas e utilização dos veículos.
            <span className="block mt-1 text-xs">
              Dados referentes à semana de {format(selectedWeekStart, "dd/MM", { locale: ptBR })} a {format(selectedWeekEnd, "dd/MM/yyyy", { locale: ptBR })} e ao mês de {selectedMonth}.
            </span>
          </>
        }
        icon={<BarChart3Icon className="mr-2 h-6 w-6 text-primary" />}
      />

      <div className="mb-6 flex justify-start">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-auto">
              <CalendarFilterIcon className="mr-2 h-4 w-4" />
              Data de Referência: {format(reportReferenceDate, "PPP", { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={reportReferenceDate}
              onSelect={(date) => date && setReportReferenceDate(date)}
              initialFocus
              disabled={(date) => date > new Date()} // Disable future dates
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center"><UsersIcon className="mr-2 h-5 w-5 text-primary" />Performance dos Motoristas</CardTitle>
            <CardDescription>Resumo de quilometragem, sinistros e checklists por motorista.</CardDescription>
          </CardHeader>
          <CardContent>
            {operatorPerformance && operatorPerformance.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Motorista</TableHead>
                    <TableHead className="text-right">
                      <CalendarRangeIcon className="mr-1 h-4 w-4 text-muted-foreground inline-block align-middle" />
                      <span className="align-middle">KM (Semana)</span>
                    </TableHead>
                    <TableHead className="text-right">
                      <CalendarDaysIcon className="mr-1 h-4 w-4 text-muted-foreground inline-block align-middle" />
                      <span className="align-middle">KM (Mês)</span>
                    </TableHead>
                    <TableHead className="text-right">
                      <AlertTriangleIcon className="mr-1 h-4 w-4 text-muted-foreground inline-block align-middle" />
                      <span className="align-middle">Sinistros</span>
                    </TableHead>
                    <TableHead className="text-right">
                      <ListChecksIcon className="mr-1 h-4 w-4 text-muted-foreground inline-block align-middle" />
                      <span className="align-middle">Checklists</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operatorPerformance.map((op) => (
                    <TableRow key={op.operatorId}>
                      <TableCell>{op.operatorName}</TableCell>
                      <TableCell className="text-right">{op.kmDrivenThisWeek.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right">{op.kmDrivenThisMonth.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right">{op.totalIncidentsReported}</TableCell>
                      <TableCell className="text-right">{op.totalChecklistsSubmitted}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-4">Nenhum dado de performance de motorista disponível para o período.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center"><TruckIcon className="mr-2 h-5 w-5 text-primary" />Quilometragem dos Veículos</CardTitle>
            <CardDescription>Quilometragem rodada por cada veículo na semana e mês de referência.</CardDescription>
          </CardHeader>
          <CardContent>
            {vehicleMileage && vehicleMileage.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Veículo (Placa)</TableHead>
                    <TableHead className="hidden sm:table-cell">Modelo</TableHead>
                    <TableHead className="text-right">
                       <CalendarRangeIcon className="mr-1 h-4 w-4 text-muted-foreground inline-block align-middle" />
                       <span className="align-middle">KM (Semana)</span>
                    </TableHead>
                    <TableHead className="text-right">
                       <CalendarDaysIcon className="mr-1 h-4 w-4 text-muted-foreground inline-block align-middle" />
                       <span className="align-middle">KM (Mês)</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicleMileage.map((v) => (
                    <TableRow key={v.vehicleId}>
                      <TableCell>{v.plate}</TableCell>
                      <TableCell className="hidden sm:table-cell">{v.make} {v.model}</TableCell>
                      <TableCell className="text-right">{v.kmDrivenThisWeek.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right">{v.kmDrivenThisMonth.toLocaleString('pt-BR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-4">Nenhum dado de quilometragem de veículo disponível para o período.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
