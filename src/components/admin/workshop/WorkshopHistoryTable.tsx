
'use client';

import { useQuery } from '@tanstack/react-query';
import { getMaintenances } from '@/lib/services/maintenanceService';
import { getVehicles } from '@/lib/services/vehicleService';
import type { Maintenance, Vehicle, WorkshopChecklistItem } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangleIcon, HistoryIcon, PrinterIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import { useToast } from '@/hooks/use-toast';

export function WorkshopHistoryTable() {
    const { data: maintenances, isLoading: maintenancesLoading, error: maintenancesError } = useQuery<Maintenance[], Error>({
        queryKey: ['maintenances', 'completed'],
        queryFn: () => getMaintenances({ status: 'completed' }),
    });

    const { data: vehicles, isLoading: vehiclesLoading, error: vehiclesError } = useQuery<Vehicle[], Error>({
        queryKey: ['vehicles'],
        queryFn: getVehicles,
    });

    const { toast } = useToast();
    const isLoading = maintenancesLoading || vehiclesLoading;
    const queryError = maintenancesError || vehiclesError;

    const workshopHistory = maintenances?.filter(m => m.workshopName && m.workshopPickUpDate).sort((a, b) => new Date(b.workshopPickUpDate!).getTime() - new Date(a.workshopPickUpDate!).getTime());

    const getStatusText = (value: 'ok' | 'nok' | 'na' | undefined): string => {
        const config = { ok: 'Conforme', nok: 'Não Conforme', na: 'N/A' };
        return value ? config[value] : '-';
    };

    const handleGeneratePdf = (maintenance: Maintenance) => {
        const vehicle = vehicles?.find(v => v.id === maintenance.vehicleId);
        if (!vehicle) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Veículo não encontrado para gerar PDF.' });
            return;
        }

        const doc = new jsPDF();
        const dropOffItems = maintenance.workshopChecklist?.dropOffItems || [];
        const pickUpItems = maintenance.workshopChecklist?.pickUpItems || [];
        let yPos = 20;

        doc.setFontSize(18);
        doc.text("Relatório de Entrega e Retirada da Oficina", 105, yPos, { align: 'center' });
        yPos += 10;
        
        doc.setFontSize(12);
        doc.text(`Veículo: ${vehicle.plate} - ${vehicle.make} ${vehicle.model}`, 15, yPos);
        yPos += 7;
        doc.text(`Manutenção: ${maintenance.description}`, 15, yPos);
        yPos += 7;
        doc.text(`Oficina: ${maintenance.workshopName || 'Não informado'}`, 15, yPos);
        yPos += 10;
        
        doc.setFontSize(14);
        doc.text("Checklist de Entrega", 15, yPos);
        yPos += 7;
        doc.setFontSize(10);
        doc.text(`Data: ${maintenance.workshopDropOffDate ? format(new Date(maintenance.workshopDropOffDate), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}`, 15, yPos);
        yPos += 7;
        dropOffItems.forEach(item => {
            doc.text(`- ${item.label}: ${getStatusText(item.value)}`, 20, yPos);
            yPos += 6;
        });
        if (maintenance.workshopDropOffObservations) {
            yPos += 2;
            doc.text(`Obs. Entrega: ${maintenance.workshopDropOffObservations}`, 15, yPos);
            yPos += 7;
        }
        yPos += 5;

        doc.setFontSize(14);
        doc.text("Checklist de Retirada", 15, yPos);
        yPos += 7;
        doc.setFontSize(10);
        doc.text(`Data: ${maintenance.workshopPickUpDate ? format(new Date(maintenance.workshopPickUpDate), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}`, 15, yPos);
        yPos += 7;
        pickUpItems.forEach(item => {
             doc.text(`- ${item.label}: ${getStatusText(item.value)}`, 20, yPos);
            yPos += 6;
        });
        if (maintenance.workshopPickUpObservations) {
            yPos += 2;
            doc.text(`Obs. Retirada: ${maintenance.workshopPickUpObservations}`, 15, yPos);
            yPos += 7;
        }
        if (maintenance.cost !== undefined) {
            doc.text(`Custo Final: R$ ${maintenance.cost?.toFixed(2)}`, 15, yPos);
            yPos += 7;
        }

        doc.save(`relatorio_oficina_${vehicle.plate}_${maintenance.id.substring(0,6)}.pdf`);
        toast({ title: 'PDF Gerado', description: 'O download do relatório deve iniciar.' });
    };

    if (isLoading) {
        return <Skeleton className="h-96 w-full" />;
    }

    if (queryError) {
        return (
            <Alert variant="destructive">
                <AlertTriangleIcon className="h-4 w-4" />
                <AlertTitle>Erro ao carregar histórico</AlertTitle>
                <AlertDescription>{queryError.message}</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Veículo</TableHead>
                        <TableHead className="hidden md:table-cell">Manutenção</TableHead>
                        <TableHead>Oficina</TableHead>
                        <TableHead className="hidden lg:table-cell">Data Entrega</TableHead>
                        <TableHead className="hidden lg:table-cell">Data Retirada</TableHead>
                        <TableHead className="text-right">Custo (R$)</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {workshopHistory && workshopHistory.length > 0 ? (
                        workshopHistory.map((m) => {
                            const vehicle = vehicles?.find(v => v.id === m.vehicleId);
                            return (
                                <TableRow key={m.id}>
                                    <TableCell className="font-medium">{vehicle ? `${vehicle.plate} - ${vehicle.model}` : 'Desconhecido'}</TableCell>
                                    <TableCell className="hidden md:table-cell truncate max-w-xs">{m.description}</TableCell>
                                    <TableCell>{m.workshopName}</TableCell>
                                    <TableCell className="hidden lg:table-cell">{m.workshopDropOffDate ? format(parseISO(m.workshopDropOffDate), 'dd/MM/yy HH:mm') : '-'}</TableCell>
                                    <TableCell className="hidden lg:table-cell">{m.workshopPickUpDate ? format(parseISO(m.workshopPickUpDate), 'dd/MM/yy HH:mm') : '-'}</TableCell>
                                    <TableCell className="text-right">{m.cost?.toFixed(2) || '0.00'}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => handleGeneratePdf(m)}>
                                            <PrinterIcon className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    ) : (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center h-24">
                                <HistoryIcon className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                                Nenhum histórico de oficina encontrado.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

