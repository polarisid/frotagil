
'use client';

import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import type { Vehicle, Maintenance, WorkshopChecklistItem } from '@/lib/types';
import { pickUpVehicleFromWorkshop } from '@/lib/services/maintenanceService';
import { Loader2Icon, SendIcon, PrinterIcon, ArrowDownToLineIcon } from 'lucide-react';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

const WORKSHOP_CHECKLIST_ITEMS = [
    { id: 'documents', label: 'Documentação do veículo (CRLV)' },
    { id: 'keys', label: 'Chaves (principal e reserva, se aplicável)' },
    { id: 'tools', label: 'Ferramentas (macaco, chave de roda)' },
    { id: 'spareTire', label: 'Estepe' },
    { id: 'bodywork', label: 'Lataria e pintura (sem novas avarias)' },
    { id: 'tires', label: 'Pneus (em bom estado geral)' },
    { id: 'interior', label: 'Interior do veículo (limpeza)' },
];

const createPickUpSchema = (items: { id: string; label: string }[]) => {
    const checklistSchema = items.reduce((schema, item) => {
        return {
            ...schema,
            [item.id]: z.enum(['ok', 'nok', 'na'], { required_error: `Selecione uma opção para "${item.label}"` })
        };
    }, {});

    return z.object({
        workshopPickUpObservations: z.string().optional(),
        cost: z.preprocess(
            (val) => (String(val).trim() === '' ? undefined : Number(String(val).replace(',', '.'))),
            z.number({ invalid_type_error: "Custo deve ser um número." }).min(0, "Custo não pode ser negativo.").optional()
        ),
        checklist: z.object(checklistSchema)
    });
};

const pickUpSchema = createPickUpSchema(WORKSHOP_CHECKLIST_ITEMS);
type PickUpFormValues = z.infer<typeof pickUpSchema>;

interface WorkshopPickUpDialogProps {
    vehicle: Vehicle;
    maintenance: Maintenance;
}

export function WorkshopPickUpDialog({ vehicle, maintenance }: WorkshopPickUpDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const form = useForm<PickUpFormValues>({
        resolver: zodResolver(pickUpSchema),
        defaultValues: {
            workshopPickUpObservations: maintenance.workshopPickUpObservations || '',
            cost: maintenance.cost || undefined,
        }
    });
    
    // Reset form values when dialog opens to ensure fresh state, especially for cost
    React.useEffect(() => {
        if (isOpen) {
            form.reset({
                workshopPickUpObservations: maintenance.workshopPickUpObservations || '',
                cost: maintenance.cost || undefined, // Start with existing cost if any, can be cleared by user
                // checklist is not set here, it will be blank as intended
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);


    const pickUpMutation = useMutation({
        mutationFn: pickUpVehicleFromWorkshop,
        onSuccess: (_, variables) => {
            toast({ title: 'Sucesso!', description: 'Veículo retirado da oficina com sucesso.' });
            queryClient.invalidateQueries({ queryKey: ['vehicles'] });
            queryClient.invalidateQueries({ queryKey: ['maintenances'] });
            handleGeneratePdf(variables.workshopChecklist.pickUpItems);
            setIsOpen(false);
            form.reset();
        },
        onError: (error: Error) => {
            toast({ variant: 'destructive', title: 'Erro', description: error.message });
        }
    });

    const onSubmit = (values: PickUpFormValues) => {
        const pickUpItems: WorkshopChecklistItem[] = WORKSHOP_CHECKLIST_ITEMS.map(item => ({
            id: item.id,
            label: item.label,
            value: values.checklist[item.id as keyof typeof values.checklist]
        }));
        
        pickUpMutation.mutate({
            maintenanceId: maintenance.id,
            vehicleId: vehicle.id,
            workshopPickUpObservations: values.workshopPickUpObservations,
            cost: values.cost,
            workshopChecklist: {
                dropOffItems: maintenance.workshopChecklist?.dropOffItems || [],
                pickUpItems: pickUpItems
            }
        });
    };

    const statusBadge = (value: 'ok' | 'nok' | 'na' | undefined) => {
        const config = {
            ok: { label: 'Conforme', className: 'bg-green-100 text-green-700' },
            nok: { label: 'Não Conforme', className: 'bg-red-100 text-red-700' },
            na: { label: 'N/A', className: 'bg-gray-100 text-gray-700' },
        };
        const status = value && config[value] ? config[value] : {label: '-', className: ''};
        return <Badge variant="outline" className={status.className}>{status.label}</Badge>;
    };

    const getStatusText = (value: 'ok' | 'nok' | 'na' | undefined): string => {
        const config = { ok: 'Conforme', nok: 'Não Conforme', na: 'N/A' };
        return value ? config[value] : '-';
    };


    const handleGenerateDropOffPdf = () => {
        const doc = new jsPDF();
        const dropOffItems = maintenance.workshopChecklist?.dropOffItems || [];
        
        let yPos = 20;
        doc.setFontSize(18);
        doc.text("Relatório de Entrega na Oficina", 105, yPos, { align: 'center' });
        yPos += 10;
        
        doc.setFontSize(12);
        doc.text(`Veículo: ${vehicle.plate} - ${vehicle.make} ${vehicle.model}`, 15, yPos);
        yPos += 7;
        doc.text(`Manutenção: ${maintenance.description}`, 15, yPos);
        yPos += 7;
        doc.text(`Oficina: ${maintenance.workshopName || 'Não informado'}`, 15, yPos);
        yPos += 7;
        doc.text(`KM de Entrega: ${vehicle.mileage?.toLocaleString('pt-BR') || 'N/A'} km`, 15, yPos);
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
            doc.text(`Obs. Entrega: ${maintenance.workshopDropOffObservations}`, 15, yPos);
            yPos += 7;
        }
       
        doc.save(`checklist_entrega_${vehicle.plate}.pdf`);
    };

    const handleGeneratePdf = (pickUpItems: WorkshopChecklistItem[]) => {
        const doc = new jsPDF();
        const dropOffItems = maintenance.workshopChecklist?.dropOffItems || [];
        
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
        yPos += 7;
        doc.text(`KM de Entrega: ${vehicle.mileage?.toLocaleString('pt-BR') || 'N/A'} km`, 15, yPos);
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
            doc.text(`Obs. Entrega: ${maintenance.workshopDropOffObservations}`, 15, yPos);
            yPos += 7;
        }
        yPos += 5;

        doc.setFontSize(14);
        doc.text("Checklist de Retirada", 15, yPos);
        yPos += 7;
        doc.setFontSize(10);
        doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 15, yPos);
        yPos += 7;
        pickUpItems.forEach(item => {
             doc.text(`- ${item.label}: ${getStatusText(item.value)}`, 20, yPos);
            yPos += 6;
        });
        if (form.getValues('workshopPickUpObservations')) {
            doc.text(`Obs. Retirada: ${form.getValues('workshopPickUpObservations')}`, 15, yPos);
            yPos += 7;
        }
         if (form.getValues('cost') !== undefined) {
            doc.text(`Custo Final: R$ ${form.getValues('cost')?.toFixed(2)}`, 15, yPos);
            yPos += 7;
        }

        doc.save(`relatorio_oficina_${vehicle.plate}.pdf`);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="w-full">
                    <ArrowDownToLineIcon className="w-4 h-4 mr-2" />
                    Registrar Retirada
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Retirar Veículo da Oficina: {vehicle.plate}</DialogTitle>
                    <DialogDescription>Confira os itens de entrega, preencha o checklist de retirada e finalize a manutenção.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex-grow min-h-0 flex flex-col">
                        <div className="flex-grow min-h-0 md:grid md:grid-cols-2 md:gap-6">
                            <div className="flex flex-col h-full">
                                <ScrollArea className="flex-grow pr-4 -mr-4">
                                    <div className="space-y-4 p-1">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-semibold text-lg">Detalhes da Entrega</h4>
                                            <Button type="button" variant="outline" size="sm" onClick={handleGenerateDropOffPdf}>
                                                <PrinterIcon className="h-4 w-4 mr-2" />
                                                Baixar PDF de Entrega
                                            </Button>
                                        </div>
                                        <Separator />
                                        <div className="space-y-3 text-sm">
                                            <p><strong>Oficina:</strong> {maintenance.workshopName}</p>
                                            <p><strong>Data da Entrega:</strong> {maintenance.workshopDropOffDate ? format(new Date(maintenance.workshopDropOffDate), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}</p>
                                            <p><strong>Observações da Entrega:</strong> {maintenance.workshopDropOffObservations || 'Nenhuma'}</p>
                                            <div>
                                                <h5 className="font-semibold mb-2">Checklist de Entrega:</h5>
                                                <ul className="space-y-1 pl-4 list-disc">
                                                    {maintenance.workshopChecklist?.dropOffItems.map(item => (
                                                        <li key={item.id} className="flex justify-between">
                                                            <span>{item.label}</span>
                                                            {statusBadge(item.value)}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </ScrollArea>
                            </div>
                            <div className="flex flex-col h-full mt-6 md:mt-0">
                                <ScrollArea className="flex-grow pl-0 md:pl-4 -ml-4">
                                    <div className="space-y-4 p-1">
                                        <h4 className="font-semibold text-lg">Registro de Retirada</h4>
                                        <Separator />
                                        <div className="space-y-4 rounded-md border p-4">
                                            <h5 className="font-medium">Checklist de Retirada</h5>
                                            {WORKSHOP_CHECKLIST_ITEMS.map(item => (
                                                <FormField
                                                    key={item.id}
                                                    control={form.control}
                                                    name={`checklist.${item.id}` as any}
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-2 rounded-md border-b p-3">
                                                            <FormLabel>{item.label}</FormLabel>
                                                            <FormControl>
                                                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex space-x-4">
                                                                    <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="ok" /></FormControl><FormLabel className="font-normal">Conforme</FormLabel></FormItem>
                                                                    <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="nok" /></FormControl><FormLabel className="font-normal">Não Conforme</FormLabel></FormItem>
                                                                    <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="na" /></FormControl><FormLabel className="font-normal">N/A</FormLabel></FormItem>
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
                                            name="cost"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Custo Final da Manutenção (R$)</FormLabel>
                                                    <FormControl><Input type="number" placeholder="Deixe em branco se não houver custo" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} step="0.01" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="workshopPickUpObservations"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Observações da Retirada (Opcional)</FormLabel>
                                                    <FormControl><Textarea placeholder="Serviço realizado conforme o esperado, sem novas avarias..." {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                        <DialogFooter className="pt-4 border-t mt-4">
                             <DialogClose asChild>
                                <Button type="button" variant="outline">Cancelar</Button>
                            </DialogClose>
                            <Button type="submit" disabled={!form.formState.isValid || pickUpMutation.isPending}>
                                {pickUpMutation.isPending ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : <SendIcon className="mr-2 h-4 w-4" />}
                                Finalizar e Retirar Veículo
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
