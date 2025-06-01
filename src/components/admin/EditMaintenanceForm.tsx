
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription, 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, SaveIcon, WrenchIcon, AlertTriangleIcon, XCircleIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Vehicle, Maintenance } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription as UICardDescription } from '../ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateMaintenance as updateMaintenanceService } from '@/lib/services/maintenanceService';

const editMaintenanceFormSchema = z.object({
  vehicleId: z.string({ required_error: "Selecione um veículo." }),
  type: z.enum(['preventive', 'corrective'], { required_error: "Tipo de manutenção é obrigatório." }),
  description: z.string().min(5, "Descrição deve ter no mínimo 5 caracteres.").max(200, "Descrição muito longa."),
  status: z.enum(['planned', 'in_progress', 'completed', 'cancelled'], { required_error: "Status é obrigatório."}),
  scheduleBy: z.enum(['date', 'km']).optional(),
  scheduledDate: z.date().optional(),
  scheduledKm: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : Number(String(val).replace(/\./g, '').replace(',', '.'))),
    z.number({ invalid_type_error: "KM agendado deve ser um número." }).min(0, "KM não pode ser negativo.").optional()
  ),
  priority: z.enum(['low', 'medium', 'high'], { required_error: "Prioridade é obrigatória." }),
  cost: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : Number(String(val).replace(/\./g, '').replace(',', '.'))),
    z.number({ invalid_type_error: "Custo deve ser um número." }).min(0, "Custo não pode ser negativo.").optional()
  ),
  observations: z.string().max(500, "Observações muito longas.").optional(),
  completionDate: z.date().optional(),
}).refine(data => {
    if (data.scheduleBy === 'date') return !!data.scheduledDate;
    if (data.scheduleBy === 'km') return data.scheduledKm !== undefined && data.scheduledKm !== null;
    return true;
}, {
    message: "Se 'Agendar por' for selecionado, o campo correspondente (Data ou KM) é obrigatório.",
    path: ["scheduleBy"],
}).refine(data => {
    if (data.status === 'completed') return !!data.completionDate;
    return true;
}, {
    message: "Data de conclusão é obrigatória se o status for 'Concluída'.",
    path: ["completionDate"],
});


type EditMaintenanceFormValues = z.infer<typeof editMaintenanceFormSchema>;

interface EditMaintenanceFormProps {
  maintenance: Maintenance;
  vehicles: Vehicle[];
  onFormSubmitSuccess: () => void;
}

export function EditMaintenanceForm({ maintenance, vehicles, onFormSubmitSuccess }: EditMaintenanceFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scheduleBy, setScheduleBy] = useState<'date' | 'km' | undefined>(
    maintenance.scheduledDate ? 'date' : maintenance.scheduledKm !== undefined ? 'km' : undefined
  );

  // Helper to parse date strings safely
  const parseDateString = (dateString?: string): Date | undefined => {
    if (!dateString) return undefined;
    const date = parseISO(dateString);
    return isValid(date) ? date : undefined;
  };


  const form = useForm<EditMaintenanceFormValues>({
    resolver: zodResolver(editMaintenanceFormSchema),
    defaultValues: {
      ...maintenance,
      scheduledDate: parseDateString(maintenance.scheduledDate),
      completionDate: parseDateString(maintenance.completionDate),
      scheduledKm: maintenance.scheduledKm ?? undefined,
      cost: maintenance.cost ?? undefined,
      observations: maintenance.observations ?? '',
      scheduleBy: maintenance.scheduledDate ? 'date' : maintenance.scheduledKm !== undefined ? 'km' : undefined,
    },
  });

  const currentStatus = form.watch('status');

  useEffect(() => {
    if (currentStatus === 'completed' && !form.getValues('completionDate')) {
      form.setValue('completionDate', new Date());
    }
  }, [currentStatus, form]);

  const updateMaintenanceMutation = useMutation({
    mutationFn: (data: { id: string; maintenanceData: Partial<Omit<Maintenance, 'id'>> }) => 
        updateMaintenanceService(data.id, data.maintenanceData),
    onSuccess: () => {
        toast({
            title: 'Manutenção Atualizada!',
            description: `A manutenção para o veículo foi atualizada com sucesso.`,
        });
        queryClient.invalidateQueries({ queryKey: ['maintenances'] });
        queryClient.invalidateQueries({ queryKey: ['maintenance', maintenance.id] });
        onFormSubmitSuccess();
    },
    onError: (error: Error) => {
         toast({ variant: 'destructive', title: 'Erro ao Atualizar', description: error.message || 'Não foi possível atualizar a manutenção.' });
    }
  });


  function onSubmit(values: EditMaintenanceFormValues) {
    const dataToUpdate: Partial<Omit<Maintenance, 'id'>> = {
      ...values,
      scheduledDate: values.scheduleBy === 'date' && values.scheduledDate ? format(values.scheduledDate, 'yyyy-MM-dd') : undefined,
      scheduledKm: values.scheduleBy === 'km' ? values.scheduledKm : undefined,
      completionDate: values.status === 'completed' && values.completionDate ? format(values.completionDate, 'yyyy-MM-dd') : undefined,
    };
    
    if (values.status !== 'completed') {
        dataToUpdate.completionDate = undefined;
    }

    updateMaintenanceMutation.mutate({ id: maintenance.id, maintenanceData: dataToUpdate });
  }

  return (
    <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
            <CardTitle className="flex items-center text-xl">
                <WrenchIcon className="mr-2 h-6 w-6 text-primary" />
                Editar Detalhes da Manutenção
            </CardTitle>
            <UICardDescription>
                Veículo: {vehicles.find(v=>v.id === maintenance.vehicleId)?.plate} - {maintenance.description.substring(0,30)}...
            </UICardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="vehicleId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Veículo (Não editável)</FormLabel>
                        <Select value={field.value} disabled>
                            <FormControl>
                            <SelectTrigger className="bg-muted/50">
                                <SelectValue />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {vehicles.map(v => (
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

                <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Tipo de Manutenção</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="corrective">Corretiva</SelectItem>
                                <SelectItem value="preventive">Preventiva</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Descrição do Serviço</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Ex: Troca de óleo e filtros, Reparo no motor..." {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Prioridade</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Nível de prioridade" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="low">Baixa</SelectItem>
                                <SelectItem value="medium">Média</SelectItem>
                                <SelectItem value="high">Alta <AlertTriangleIcon className="inline h-4 w-4 text-orange-500 ml-1"/></SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Status da Manutenção</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o status" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="planned">Planejada</SelectItem>
                                <SelectItem value="in_progress">Em Progresso</SelectItem>
                                <SelectItem value="completed">Concluída</SelectItem>
                                <SelectItem value="cancelled">Cancelada <XCircleIcon className="inline h-4 w-4 text-red-500 ml-1"/></SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />


                <FormField
                  control={form.control}
                  name="scheduleBy"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Agendar por (Opcional):</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => {
                            const val = value as 'date' | 'km' | undefined;
                            field.onChange(val);
                            setScheduleBy(val);
                            if (val !== 'date') form.setValue('scheduledDate', undefined);
                            if (val !== 'km') form.setValue('scheduledKm', undefined);
                          }}
                          value={field.value}
                          className="flex flex-col space-y-1 sm:flex-row sm:space-y-0 sm:space-x-4"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="date" />
                            </FormControl>
                            <FormLabel className="font-normal">Data Específica</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="km" />
                            </FormControl>
                            <FormLabel className="font-normal">Quilometragem</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {scheduleBy === 'date' && (
                     <FormField
                        control={form.control}
                        name="scheduledDate"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Data Agendada</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant="outline"
                                    className={`w-full justify-start text-left font-normal ${
                                    !field.value && "text-muted-foreground"
                                    }`}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? (
                                    format(field.value, "PPP", { locale: ptBR })
                                    ) : (
                                    <span>Escolha uma data</span>
                                    )}
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                    date < new Date(new Date().setDate(new Date().getDate() -1)) 
                                }
                                initialFocus
                                />
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                )}

                {scheduleBy === 'km' && (
                    <FormField
                        control={form.control}
                        name="scheduledKm"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>KM Agendado</FormLabel>
                            <FormControl>
                            <Input type="number" placeholder="Ex: 150000" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
                            </FormControl>
                            <FormDescription>
                                A manutenção será indicada quando o veículo atingir esta quilometragem.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                )}

                {form.getValues("status") === 'completed' && (
                     <FormField
                        control={form.control}
                        name="completionDate"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Data de Conclusão</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant="outline"
                                    className={`w-full justify-start text-left font-normal ${
                                    !field.value && "text-muted-foreground"
                                    }`}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? (
                                    format(field.value, "PPP", { locale: ptBR })
                                    ) : (
                                    <span>Escolha uma data</span>
                                    )}
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                    date > new Date() || date < new Date("2000-01-01") // allow more historical dates
                                }
                                initialFocus
                                />
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                )}


                <FormField
                    control={form.control}
                    name="cost"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Custo (R$) (Opcional)</FormLabel>
                        <FormControl>
                        <Input type="number" placeholder="Ex: 250.00" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} step="0.01" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="observations"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Observações (Opcional)</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Peças necessárias, fornecedor preferencial, etc." {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <CardFooter className="px-0 pt-6">
                    <Button type="submit" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={updateMaintenanceMutation.isPending}>
                        {updateMaintenanceMutation.isPending ? 'Salvando...' : <><SaveIcon className="mr-2 h-4 w-4" /> Salvar Alterações</>}
                    </Button>
                </CardFooter>
            </form>
            </Form>
        </CardContent>
    </Card>
  );
}
