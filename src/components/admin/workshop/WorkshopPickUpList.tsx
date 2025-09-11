
'use client';

import { useQuery } from "@tanstack/react-query";
import { getVehicles } from "@/lib/services/vehicleService";
import { getMaintenances } from "@/lib/services/maintenanceService";
import type { Vehicle, Maintenance } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ConstructionIcon, WrenchIcon, AlertTriangleIcon, ClipboardListIcon, CheckCircle2Icon, XCircleIcon, MinusCircleIcon } from "lucide-react";
import { WorkshopPickUpDialog } from "./WorkshopPickUpDialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

export function WorkshopPickUpList() {

    const { data: maintenances, isLoading: maintenancesLoading, error: maintenancesError } = useQuery<Maintenance[], Error>({
        queryKey: ['maintenances', 'in_progress'],
        queryFn: () => getMaintenances({ status: 'in_progress' }),
    });

    const { data: vehicles, isLoading: vehiclesLoading, error: vehiclesError } = useQuery<Vehicle[], Error>({
        queryKey: ['vehicles'],
        queryFn: getVehicles,
    });

    const isLoading = maintenancesLoading || vehiclesLoading;
    const queryError = maintenancesError || vehiclesError;

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                        <CardContent className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (queryError) {
        return (
            <Alert variant="destructive">
                <AlertTriangleIcon className="h-4 w-4" />
                <AlertTitle>Erro ao carregar dados</AlertTitle>
                <AlertDescription>{queryError.message}</AlertDescription>
            </Alert>
        );
    }
    
    const vehiclesInMaintenance = vehicles?.filter(v => v.status === 'maintenance') || [];
    const maintenanceMap = new Map(maintenances?.map(m => [m.id, m]));

    // Find the specific 'in_progress' maintenance for each vehicle in 'maintenance' status.
    const vehiclesWithMaintenanceDetails = vehiclesInMaintenance.map(vehicle => {
        const relatedMaintenance = maintenances?.find(maint => maint.vehicleId === vehicle.id && maint.status === 'in_progress');
        return { vehicle, maintenance: relatedMaintenance };
    }).filter(item => item.maintenance); // Only include vehicles that have a matching in_progress maintenance record

    const statusBadge = (value: 'ok' | 'nok' | 'na' | undefined) => {
        const statusConfig = {
            ok: { label: 'Conforme', icon: CheckCircle2Icon, className: 'bg-green-100 text-green-800' },
            nok: { label: 'Não Conforme', icon: XCircleIcon, className: 'bg-red-100 text-red-800' },
            na: { label: 'N/A', icon: MinusCircleIcon, className: 'bg-gray-100 text-gray-800' },
        };
        const config = value && statusConfig[value] ? statusConfig[value] : {label: '-', icon: () => null, className: ''};
        const Icon = config.icon;
        return <Badge variant="outline" className={config.className}><Icon className="mr-1 h-3 w-3" />{config.label}</Badge>;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Veículos na Oficina</CardTitle>
                <CardDescription>Selecione um veículo abaixo para registrar a retirada e concluir a manutenção.</CardDescription>
            </CardHeader>
            <CardContent>
                {vehiclesWithMaintenanceDetails.length === 0 ? (
                    <Alert>
                        <ConstructionIcon className="h-4 w-4" />
                        <AlertTitle>Nenhum veículo na oficina</AlertTitle>
                        <AlertDescription>Não há veículos com status "Em Manutenção" e com uma manutenção "Em Progresso" associada no momento.</AlertDescription>
                    </Alert>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {vehiclesWithMaintenanceDetails.map(({ vehicle, maintenance }) => (
                            <Card key={vehicle.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
                                <div>
                                    <CardHeader>
                                        <CardTitle>{vehicle.plate}</CardTitle>
                                        <CardDescription>{vehicle.make} {vehicle.model}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <p className="text-sm flex items-start">
                                            <WrenchIcon className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0 mt-0.5" />
                                            <span className="flex-grow">{maintenance!.description}</span>
                                        </p>
                                        <p className="text-sm font-semibold">Oficina: {maintenance!.workshopName || 'Não informado'}</p>
                                        
                                        <Accordion type="single" collapsible className="w-full">
                                            <AccordionItem value="item-1" className="border-b-0">
                                                <AccordionTrigger className="text-sm py-2 hover:no-underline">
                                                    <ClipboardListIcon className="h-4 w-4 mr-2" />
                                                    Ver Checklist de Entrega
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <ul className="space-y-1 text-xs text-muted-foreground pl-2 mt-2">
                                                        {maintenance?.workshopChecklist?.dropOffItems.map(item => (
                                                            <li key={item.id} className="flex justify-between items-center">
                                                                <span>- {item.label}</span>
                                                                {statusBadge(item.value)}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                    </CardContent>
                                </div>
                                <div className="p-6 pt-0">
                                     <WorkshopPickUpDialog vehicle={vehicle} maintenance={maintenance!} />
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
