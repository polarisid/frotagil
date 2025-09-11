
'use client';

import * as z from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getVehicles } from '@/lib/services/vehicleService';
import { getMaintenances, dropOffVehicleAtWorkshop } from '@/lib/services/maintenanceService';
import type { Vehicle, Maintenance, WorkshopChecklistItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2Icon, SendIcon, GaugeIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { addDays, differenceInDays, isPast, isToday, parseISO, isValid, format } from 'date-fns';

const WORKSHOP_CHECKLIST_ITEMS = [
    { id: 'documents', label: 'Documentação do veículo (CRLV)' },
    { id: 'keys', label: 'Chaves (principal e reserva, se aplicável)' },
    { id: 'tools', label: 'Ferramentas (macaco, chave de roda)' },
    { id: 'spareTire', label: 'Estepe' },
    { id: 'bodywork', label: 'Lataria e pintura (sem avarias visíveis)' },
    { id: 'tires', label: 'Pneus (em bom estado geral)' },
    { id: 'interior', label: 'Interior do veículo (limpeza, sem objetos pessoais)' },
];

const createDropOffSchema = (items: { id: string; label: string }[], currentMileage: number) => {
    const checklistSchema = items.reduce((schema, item) => {
        return {
            ...schema,
            [item.id]: z.enum(['ok', 'nok', 'na'], { required_error: `Selecione uma opção para "${item.label}"` })
        };
    }, {});

    return z.object({
        vehicleId: z.string({ required_error: "Selecione um veículo." }),
        maintenanceId: z.string({ required_error: "Selecione uma manutenção." }),
        mileage: z.preprocess(
            (val) => (String(val).trim() === '' ? undefined : Number(String(val).replace(/\./g, ''))),
            z.number({ required_error: "KM é obrigatório." })
             .min(currentMileage, { message: `KM não pode ser menor que a atual (${currentMileage.toLocaleString('pt-BR')}).` })
        ),
        workshopName: z.string().min(3, "Nome da oficina é obrigatório."),
        workshopDropOffObservations: z.string().optional(),
        checklist: z.object(checklistSchema)
    });
};


const KM_ALERT_THRESHOLD = 10000;
const DATE_UPCOMING_THRESHOLD_DAYS = 30;

export function WorkshopDropOffForm() {
    const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: vehicles, isLoading: vehiclesLoading } = useQuery<Vehicle[], Error>({
        queryKey: ['vehicles'],
        queryFn: getVehicles,
        select: (data) => data.filter(v => v.status === 'active' && !v.assignedOperatorId)
    });

    const selectedVehicle = vehicles?.find(v => v.id === selectedVehicleId);
    
    const dropOffSchema = createDropOffSchema(WORKSHOP_CHECKLIST_ITEMS, selectedVehicle?.mileage || 0);
    type DropOffFormValues = z.infer<typeof dropOffSchema>;

    const { data: maintenances, isLoading: maintenancesLoading } = useQuery<Maintenance[], Error>({
        queryKey: ['maintenances', selectedVehicleId, 'relevantForWorkshop'],
        queryFn: () => getMaintenances({ vehicleId: selectedVehicleId }),
        enabled: !!selectedVehicleId,
        select: (allMaintenances) => {
            if (!selectedVehicleId) return [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            return allMaintenances.filter(maint => {
                if (maint.status !== 'planned') {
                    return false;
                }

                let isRelevant = false;
                if (maint.scheduledDate) {
                    const scheduledDateObj = parseISO(maint.scheduledDate);
                    if (isValid(scheduledDateObj)) {
                        const diffDays = differenceInDays(scheduledDateObj, today);
                        if (diffDays <= DATE_UPCOMING_THRESHOLD_DAYS) { 
                            isRelevant = true;
                        }
                    }
                }
                
                const vehicleForMaint = vehicles?.find(v => v.id === maint.vehicleId);
                if (vehicleForMaint && maint.scheduledKm && typeof vehicleForMaint.mileage === 'number') {
                    const kmDifference = maint.scheduledKm - vehicleForMaint.mileage;
                    if (kmDifference <= KM_ALERT_THRESHOLD) {
                        isRelevant = true;
                    }
                }
                return isRelevant;
            });
        }
    });

    const form = useForm<DropOffFormValues>({
        resolver: zodResolver(dropOffSchema),
        defaultValues: {
            workshopName: '',
            workshopDropOffObservations: '',
        }
    });
    
    useEffect(() => {
        if (selectedVehicle) {
            form.setValue('mileage', selectedVehicle.mileage || 0);
        } else {
             form.resetField('mileage');
        }
    }, [selectedVehicle, form]);


    const dropOffMutation = useMutation({
        mutationFn: dropOffVehicleAtWorkshop,
        onSuccess: () => {
            toast({ title: 'Sucesso!', description: 'Veículo entregue na oficina com sucesso.' });
            queryClient.invalidateQueries({ queryKey: ['vehicles'] });
            queryClient.invalidateQueries({ queryKey: ['maintenances'] });
            form.reset();
            setSelectedVehicleId(undefined);
        },
        onError: (error: Error) => {
            toast({ variant: 'destructive', title: 'Erro', description: error.message });
        }
    });

    const onSubmit = (values: DropOffFormValues) => {
        const dropOffItems: WorkshopChecklistItem[] = WORKSHOP_CHECKLIST_ITEMS.map(item => ({
            id: item.id,
            label: item.label,
            value: values.checklist[item.id as keyof typeof values.checklist]
        }));
        
        dropOffMutation.mutate({
            maintenanceId: values.maintenanceId,
            vehicleId: values.vehicleId,
            mileage: values.mileage,
            workshopName: values.workshopName,
            workshopDropOffObservations: values.workshopDropOffObservations,
            workshopChecklist: {
                dropOffItems,
                pickUpItems: []
            }
        });
    };
    
    const selectedMaintenance = maintenances?.find(m => m.id === form.watch('maintenanceId'));
    const getMaintenanceDisplayText = (maint: Maintenance) => {
      const scheduleInfo = maint.scheduledKm 
        ? `${maint.scheduledKm.toLocaleString('pt-BR')}km` 
        : (maint.scheduledDate ? format(parseISO(maint.scheduledDate), 'dd/MM/yy') : 'N/A');
      return `(${scheduleInfo}) ${maint.description}`;
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle>Formulário de Entrega na Oficina</CardTitle>
                <CardDescription>Preencha todos os campos para registrar a entrega de um veículo para manutenção.</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-6">
                        <FormField
                            control={form.control}
                            name="vehicleId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>1. Selecione o Veículo (Apenas veículos livres e ativos)</FormLabel>
                                    <Select
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                            setSelectedVehicleId(value);
                                            form.resetField("maintenanceId");
                                            form.resetField("mileage");
                                        }}
                                        value={field.value}
                                        disabled={vehiclesLoading || dropOffMutation.isPending}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={vehiclesLoading ? "Carregando..." : "Selecione um veículo"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {vehicles?.map(v => (
                                                <SelectItem key={v.id} value={v.id}>
                                                    {v.plate} - {v.make} {v.model}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {selectedVehicleId && (
                            <>
                             <FormField
                                control={form.control}
                                name="maintenanceId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>2. Selecione a Manutenção Relacionada (Vencidas ou Próximas)</FormLabel>
                                        <Select 
                                            onValueChange={field.onChange} 
                                            value={field.value}
                                            disabled={maintenancesLoading || !maintenances || maintenances.length === 0 || dropOffMutation.isPending}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="h-auto min-h-10 text-left justify-start data-[placeholder]:text-muted-foreground block">
                                                    {selectedMaintenance ? (
                                                        <div className="whitespace-normal py-1">{getMaintenanceDisplayText(selectedMaintenance)}</div>
                                                    ) : (
                                                        <SelectValue
                                                            placeholder={maintenancesLoading ? "Carregando..." : (maintenances?.length === 0 ? "Nenhuma manutenção relevante encontrada" : "Selecione uma manutenção")} 
                                                        />
                                                    )}
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {maintenances?.map(m => (
                                                    <SelectItem key={m.id} value={m.id} className="whitespace-normal">
                                                        {getMaintenanceDisplayText(m)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="mileage"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center"><GaugeIcon className="mr-2 h-4 w-4"/>3. KM de Entrega</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} disabled={dropOffMutation.isPending}/>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            </>
                        )}

                        <FormField
                            control={form.control}
                            name="workshopName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>4. Nome da Oficina</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: Oficina do Zé" {...field} disabled={dropOffMutation.isPending} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="space-y-4 rounded-md border p-4">
                            <h4 className="font-medium">5. Checklist de Entrega</h4>
                            {WORKSHOP_CHECKLIST_ITEMS.map(item => (
                                <FormField
                                    key={item.id}
                                    control={form.control}
                                    name={`checklist.${item.id}` as any}
                                    render={({ field }) => (
                                        <FormItem className="space-y-2 rounded-md border-b p-3">
                                            <FormLabel>{item.label}</FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                    className="flex space-x-4"
                                                    disabled={dropOffMutation.isPending}
                                                >
                                                    <FormItem className="flex items-center space-x-2">
                                                        <FormControl><RadioGroupItem value="ok" /></FormControl>
                                                        <FormLabel className="font-normal">Conforme</FormLabel>
                                                    </FormItem>
                                                    <FormItem className="flex items-center space-x-2">
                                                        <FormControl><RadioGroupItem value="nok" /></FormControl>
                                                        <FormLabel className="font-normal">Não Conforme</FormLabel>
                                                    </FormItem>
                                                    <FormItem className="flex items-center space-x-2">
                                                        <FormControl><RadioGroupItem value="na" /></FormControl>
                                                        <FormLabel className="font-normal">N/A</FormLabel>
                                                    </FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ))}
                        </div>
                        
                        <FormField
                            control={form.control}
                            name="workshopDropOffObservations"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>6. Observações da Entrega (Opcional)</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Descreva qualquer detalhe importante sobre a entrega do veículo..." {...field} disabled={dropOffMutation.isPending} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={!form.formState.isValid || dropOffMutation.isPending}>
                            {dropOffMutation.isPending ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : <SendIcon className="mr-2 h-4 w-4" />}
                            Registrar Entrega
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
