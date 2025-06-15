

'use client';

import { useQuery } from '@tanstack/react-query';
import { PageTitle } from '@/components/shared/PageTitle';
import { Container } from '@/components/shared/Container';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangleIcon, BarChart3Icon, UsersIcon, TruckIcon, CalendarDaysIcon, CalendarRangeIcon, ListChecksIcon, CalendarIcon as CalendarFilterIcon, TrendingUpIcon, DollarSignIcon, WrenchIcon, ReceiptTextIcon } from 'lucide-react';
import { getOperatorPerformanceReport, getVehicleMileageReport, getVehicleCostReport } from '@/lib/services/reportService';
import type { OperatorPerformanceReportItem, VehicleMileageReportItem, VehicleCostReportItem, Maintenance, Fine } from '@/lib/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getYear, startOfYear, endOfYear, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { KPICard } from '@/components/admin/KPICard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as DialogDesc } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { getMaintenances } from '@/lib/services/maintenanceService';
import { getFines } from '@/lib/services/fineService';

export default function AdminReportsPage() {
  const [reportReferenceDate, setReportReferenceDate] = useState<Date>(new Date());
  const [vehicleDetailsDialogOpen, setVehicleDetailsDialogOpen] = useState(false);
  const [selectedVehicleForDetails, setSelectedVehicleForDetails] = useState<VehicleCostReportItem | null>(null);

  const { data: operatorPerformance, isLoading: operatorLoading, error: operatorError } = useQuery<OperatorPerformanceReportItem[], Error>({
    queryKey: ['operatorPerformanceReport', reportReferenceDate.toISOString().split('T')[0]],
    queryFn: () => getOperatorPerformanceReport(reportReferenceDate),
  });

  const { data: vehicleMileage, isLoading: vehicleLoading, error: vehicleError } = useQuery<VehicleMileageReportItem[], Error>({
    queryKey: ['vehicleMileageReport', reportReferenceDate.toISOString().split('T')[0]],
    queryFn: () => getVehicleMileageReport(reportReferenceDate),
  });

  const { data: vehicleCosts, isLoading: costsLoading, error: costsError } = useQuery<VehicleCostReportItem[], Error>({
    queryKey: ['vehicleCostReport', reportReferenceDate.toISOString().split('T')[0]],
    queryFn: () => getVehicleCostReport(reportReferenceDate),
  });
  
  const yearOfReference = getYear(reportReferenceDate);

  const { data: detailedMaintenances, isLoading: detailedMaintenancesLoading, error: detailedMaintenancesError } = useQuery<Maintenance[], Error>({
    queryKey: ['detailedMaintenances', selectedVehicleForDetails?.vehicleId, yearOfReference],
    queryFn: async () => {
      console.log(`[ReportsPage] Fetching detailed maintenances for vehicle: ${selectedVehicleForDetails?.vehicleId}, year: ${yearOfReference}`);
      if (!selectedVehicleForDetails) return [];
      const allMaint = await getMaintenances({ vehicleId: selectedVehicleForDetails.vehicleId });
      console.log(`[ReportsPage] Fetched ${allMaint.length} maintenances for vehicle ${selectedVehicleForDetails.vehicleId} before year filter.`);
      const filteredMaint = allMaint.filter(m => {
          const dateToCheckStr = m.status === 'completed' ? m.completionDate : m.scheduledDate;
          if (!dateToCheckStr) return false;
          const dateToCheck = parseISO(dateToCheckStr);
          const isCorrectYear = isValid(dateToCheck) && getYear(dateToCheck) === yearOfReference;
          // console.log(`[ReportsPage] Maint ID ${m.id}, dateToCheckStr: ${dateToCheckStr}, dateToCheck: ${dateToCheck}, isCorrectYear: ${isCorrectYear}`);
          return isCorrectYear;
      });
      console.log(`[ReportsPage] Filtered to ${filteredMaint.length} maintenances for year ${yearOfReference}.`);
      return filteredMaint;
    },
    enabled: !!selectedVehicleForDetails && vehicleDetailsDialogOpen,
  });

  const { data: detailedFines, isLoading: detailedFinesLoading, error: detailedFinesError } = useQuery<Fine[], Error>({
    queryKey: ['detailedFines', selectedVehicleForDetails?.vehicleId, yearOfReference],
    queryFn: async () => {
      console.log(`[ReportsPage] Fetching detailed fines for vehicle: ${selectedVehicleForDetails?.vehicleId}, year: ${yearOfReference}`);
      if (!selectedVehicleForDetails) return [];
      const fines = await getFines({ 
        vehicleId: selectedVehicleForDetails.vehicleId,
        startDate: startOfYear(reportReferenceDate).toISOString().split('T')[0],
        endDate: endOfYear(reportReferenceDate).toISOString().split('T')[0],
      });
      console.log(`[ReportsPage] Fetched ${fines.length} fines for vehicle ${selectedVehicleForDetails.vehicleId} for year ${yearOfReference}.`);
      return fines;
    },
    enabled: !!selectedVehicleForDetails && vehicleDetailsDialogOpen,
  });


  const isLoading = operatorLoading || vehicleLoading || costsLoading;
  const queryError = operatorError || vehicleError || costsError;

  const selectedWeekStart = startOfWeek(reportReferenceDate, { locale: ptBR, weekStartsOn: 1 });
  const selectedWeekEnd = endOfWeek(reportReferenceDate, { locale: ptBR, weekStartsOn: 1 });
  const selectedMonth = format(reportReferenceDate, "MMMM 'de' yyyy", { locale: ptBR });
  const selectedYear = getYear(reportReferenceDate);

  const totalMonthlyCost = vehicleCosts?.reduce((sum, item) => sum + item.totalCostThisMonth, 0) || 0;
  const totalAnnualCostOverall = vehicleCosts?.reduce((sum, item) => sum + item.totalCostThisYear, 0) || 0;


  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleOpenVehicleDetails = (vehicleData: VehicleCostReportItem) => {
    setSelectedVehicleForDetails(vehicleData);
    setVehicleDetailsDialogOpen(true);
  };

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
         <Card className="mt-6"><CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
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
  
  const maintenanceStatusConfig: Record<Maintenance['status'], { label: string; className: string }> = {
    planned: { label: 'Planejada', className: 'bg-blue-500' },
    in_progress: { label: 'Em Progresso', className: 'bg-yellow-500 text-black' },
    completed: { label: 'Concluída', className: 'bg-green-500' },
    cancelled: { label: 'Cancelada', className: 'bg-red-500' },
  };
  
  const fineStatusConfig: Record<Fine['status'], { label: string; className: string }> = {
    pending: { label: 'Pendente', className: 'bg-yellow-500 text-black' },
    paid: { label: 'Paga', className: 'bg-green-500' },
    appealed: { label: 'Recorrida', className: 'bg-blue-500' },
    cancelled: { label: 'Cancelada', className: 'bg-red-500' },
  };


  return (
    <Container>
      <PageTitle
        title="Relatórios Gerenciais"
        description={
          <>
            Visão geral da performance dos motoristas, utilização e custos dos veículos.
            <span className="block mt-1 text-xs">
              Dados referentes à semana de {format(selectedWeekStart, "dd/MM", { locale: ptBR })} a {format(selectedWeekEnd, "dd/MM/yyyy", { locale: ptBR })}, ao mês de {selectedMonth} e ao ano de {selectedYear}.
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
              disabled={(date) => date > new Date()} 
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

      <Card className="mt-6 shadow-md">
        <CardHeader>
            <CardTitle className="flex items-center"><DollarSignIcon className="mr-2 h-5 w-5 text-primary" />Relatório de Custos</CardTitle>
            <CardDescription>Custos com manutenções e multas por veículo no mês de {selectedMonth} e no ano de {selectedYear}.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <KPICard kpi={{
                    title: `Custo Total (${selectedMonth})`,
                    value: formatCurrency(totalMonthlyCost),
                    icon: TrendingUpIcon,
                    bgColorClass: 'bg-red-100 dark:bg-red-900/30'
                }} />
                 <KPICard kpi={{
                    title: `Custo Total (${selectedYear})`,
                    value: formatCurrency(totalAnnualCostOverall),
                    icon: TrendingUpIcon,
                    bgColorClass: 'bg-destructive/10 dark:bg-destructive/20'
                }} />
            </div>
            {vehicleCosts && vehicleCosts.length > 0 ? (
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Veículo (Placa)</TableHead>
                    <TableHead className="hidden sm:table-cell">Modelo</TableHead>
                    <TableHead className="text-right">Manut. (Mês)</TableHead>
                    <TableHead className="text-right">Multas (Mês)</TableHead>
                    <TableHead className="text-right font-semibold">Total (Mês)</TableHead>
                    <TableHead className="text-right">Manut. (Ano)</TableHead>
                    <TableHead className="text-right">Multas (Ano)</TableHead>
                    <TableHead className="text-right font-semibold">Total (Ano)</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {vehicleCosts.map((vc) => (
                    <TableRow key={vc.vehicleId} className="hover:bg-secondary/50">
                      <TableCell>
                        <Button variant="link" onClick={() => handleOpenVehicleDetails(vc)} className="p-0 h-auto font-medium text-primary hover:underline">
                            {vc.plate}
                        </Button>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{vc.make} {vc.model}</TableCell>
                      <TableCell className="text-right">{formatCurrency(vc.totalMaintenanceCostThisMonth)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(vc.totalFineAmountThisMonth)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(vc.totalCostThisMonth)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(vc.totalMaintenanceCostThisYear)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(vc.totalFineAmountThisYear)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(vc.totalCostThisYear)}</TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
            ) : (
            <p className="text-muted-foreground text-center py-4">Nenhum custo de veículo registrado para o período.</p>
            )}
        </CardContent>
      </Card>
      
      <Dialog open={vehicleDetailsDialogOpen} onOpenChange={setVehicleDetailsDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes de Custo Anual para {selectedVehicleForDetails?.plate} ({selectedYear})</DialogTitle>
            <DialogDesc>
              {selectedVehicleForDetails?.make} {selectedVehicleForDetails?.model} <br />
              Custo Total no Ano: <span className="font-semibold">{formatCurrency(selectedVehicleForDetails?.totalCostThisYear || 0)}</span>
              (Manutenções: {formatCurrency(selectedVehicleForDetails?.totalMaintenanceCostThisYear || 0)} + Multas: {formatCurrency(selectedVehicleForDetails?.totalFineAmountThisYear || 0)})
            </DialogDesc>
          </DialogHeader>
          <ScrollArea className="flex-grow pr-4 -mr-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
              <section>
                <h3 className="text-lg font-semibold mb-2 flex items-center"><WrenchIcon className="mr-2 h-5 w-5 text-primary" />Manutenções ({selectedYear})</h3>
                {detailedMaintenancesLoading ? <Skeleton className="h-40 w-full" /> : 
                 detailedMaintenancesError ? <Alert variant="destructive"><AlertTriangleIcon className="h-4 w-4" /><AlertTitle>Erro</AlertTitle><AlertDescription>{detailedMaintenancesError.message}</AlertDescription></Alert> : (
                  detailedMaintenances && detailedMaintenances.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Descrição</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Custo</TableHead><TableHead>Status</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailedMaintenances.map(m => (
                          <TableRow key={m.id}>
                            <TableCell className="truncate max-w-[150px]">{m.description}</TableCell>
                            <TableCell>{format(parseISO(m.status === 'completed' && m.completionDate ? m.completionDate : m.scheduledDate!), 'dd/MM/yy', {locale: ptBR})}</TableCell>
                            <TableCell className="text-right">{formatCurrency(m.cost || 0)}</TableCell>
                            <TableCell>
                               <Badge
                                variant="outline"
                                className={`text-xs whitespace-nowrap text-white ${maintenanceStatusConfig[m.status]?.className || 'bg-gray-400'}`}
                               >
                                {maintenanceStatusConfig[m.status]?.label || m.status}
                               </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : <p className="text-sm text-muted-foreground">Nenhuma manutenção registrada para este veículo no ano.</p>
                )}
              </section>
              <section>
                <h3 className="text-lg font-semibold mb-2 flex items-center"><ReceiptTextIcon className="mr-2 h-5 w-5 text-primary" />Multas ({selectedYear})</h3>
                {detailedFinesLoading ? <Skeleton className="h-40 w-full" /> : 
                 detailedFinesError ? <Alert variant="destructive"><AlertTriangleIcon className="h-4 w-4" /><AlertTitle>Erro</AlertTitle><AlertDescription>{detailedFinesError.message}</AlertDescription></Alert> : (
                  detailedFines && detailedFines.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Infração</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailedFines.map(f => (
                          <TableRow key={f.id}>
                            <TableCell className="truncate max-w-[150px]">{f.description}</TableCell>
                            <TableCell>{format(parseISO(f.date), 'dd/MM/yy HH:mm', {locale: ptBR})}</TableCell>
                            <TableCell className="text-right">{formatCurrency(f.amount)}</TableCell>
                             <TableCell>
                               <Badge
                                variant="outline"
                                className={`text-xs whitespace-nowrap text-white ${fineStatusConfig[f.status]?.className || 'bg-gray-400'}`}
                               >
                                {fineStatusConfig[f.status]?.label || f.status}
                               </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : <p className="text-sm text-muted-foreground">Nenhuma multa registrada para este veículo no ano.</p>
                )}
              </section>
            </div>
          </ScrollArea>
          <div className="pt-4 border-t flex justify-end">
            <Button variant="outline" onClick={() => setVehicleDetailsDialogOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

    </Container>
  );
}

