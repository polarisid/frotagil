
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldErrors } from 'react-hook-form';
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
import { CalendarIcon, SaveIcon, WrenchIcon, AlertTriangleIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Vehicle, Maintenance } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addMaintenance as addMaintenanceService } from '@/lib/services/maintenanceService';
import { useAuth } from '@/hooks/useAuth';

const maintenanceFormSchema = z.object({
  vehicleId: z.string({ required_error: "Selecione um veículo." }),
  type: z.enum(['preventive', 'corrective'], { required_error: "Tipo de manutenção é obrigatório." }),
  description: z.string().min(5, "Descrição deve ter no mínimo 5 caracteres.").max(200, "Descrição muito longa."),
  scheduleBy: z.enum(['date', 'km'], { invalid_type_error: "Selecione como agendar."}).optional(),
  scheduledDate: z.date().optional(),
  scheduledKm: z.preprocess(
    (val) => {
      // console.log('[Zod Preprocess scheduledKm] Input val:', val);
      const strVal = String(val).trim();
      if (strVal === '' || strVal === 'null' || strVal === 'undefined') return undefined;
      const num = Number(strVal.replace(/\./g, '').replace(',', '.'));
      // console.log('[Zod Preprocess scheduledKm] Converted num:', num);
      return isNaN(num) ? undefined : num; // Retorna undefined se NaN para consistência
    },
    z.number({ invalid_type_error: "KM agendado deve ser um número ou estar vazio se não aplicável." })
      .min(0, "KM não pode ser negativo.")
      .optional()
  ),
  priority: z.enum(['low', 'medium', 'high'], { required_error: "Prioridade é obrigatória." }),
  cost: z.preprocess(
    (val) => {
      const strVal = String(val).trim();
      if (strVal === '') return undefined;
      const num = Number(strVal.replace(/\./g, '').replace(',', '.'));
      return isNaN(num) ? undefined : num;
    },
    z.number({ invalid_type_error: "Custo deve ser um número." }).min(0, "Custo não pode ser negativo.").optional()
  ),
  observations: z.string().max(500, "Observações muito longas.").optional().default(''),
}).superRefine((data, ctx) => {
  // console.log('[Zod superRefine] Data:', data);
  if (data.scheduleBy === 'date' && !data.scheduledDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Data agendada é obrigatória.",
      path: ['scheduledDate'],
    });
  }
  if (data.scheduleBy === 'km') {
    if (data.scheduledKm === undefined || data.scheduledKm === null || data.scheduledKm < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "KM agendado válido é obrigatório.",
        path: ['scheduledKm'],
      });
    }
  }
});


type MaintenanceFormValues = z.infer<typeof maintenanceFormSchema>;

interface NewMaintenanceFormProps {
  vehicles: Vehicle[];
  onFormSubmitSuccess: () => void;
}

export function NewMaintenanceForm({ vehicles, onFormSubmitSuccess }: NewMaintenanceFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scheduleBy, setScheduleBy] = useState<'date' | 'km' | undefined>(undefined);
  const { currentUser } = useAuth();

  const form = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceFormSchema),
    defaultValues: {
      vehicleId: undefined,
      type: 'corrective',
      description: '',
      priority: 'medium',
      observations: '',
      scheduleBy: undefined,
      cost: undefined,
      scheduledKm: undefined,
      scheduledDate: undefined,
    },
  });

  const addMaintenanceMutation = useMutation({
    mutationFn: (data: Omit<Maintenance, 'id'| 'status' | 'completionDate'>) => addMaintenanceService(data),
    onSuccess: (data) => {
      toast({
        title: 'Manutenção Agendada!',
        description: `A manutenção para ${vehicles.find(v => v.id === data.vehicleId)?.plate} foi agendada.`,
      });
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      onFormSubmitSuccess();
      form.reset();
      setScheduleBy(undefined);
    },
    onError: (error: Error) => {
        console.error("[NewMaintenanceForm] Error during mutation:", error, error.stack);
        toast({
            variant: 'destructive',
            title: 'Erro ao Agendar Manutenção',
            description: error.message || "Não foi possível agendar a manutenção. Verifique os dados ou tente novamente.",
        });
    }
  });

  function onSubmit(values: MaintenanceFormValues) {
    // console.log('[NewMaintenanceForm] onSubmit function called');
    // console.log('[NewMaintenanceForm] Raw form values:', values);
    // console.log('[NewMaintenanceForm] Current User for isAdmin check:', currentUser);

    if (!currentUser || currentUser.role !== 'admin') {
        toast({ variant: 'destructive', title: 'Não Autorizado', description: 'Apenas administradores podem agendar manutenções.' });
        return;
    }
    
    const maintenanceDataToSubmit: Omit<Maintenance, 'id' | 'status' | 'completionDate'> = {
      vehicleId: values.vehicleId!,
      type: values.type!,
      description: values.description!,
      priority: values.priority!,
      observations: values.observations || undefined,
      cost: values.cost,
      scheduledKm: values.scheduleBy === 'km' ? values.scheduledKm : undefined,
      scheduledDate: values.scheduleBy === 'date' && values.scheduledDate ? format(values.scheduledDate, 'yyyy-MM-dd') : undefined,
    };
    
    // Explicitly remove undefined fields to prevent Firestore errors
    Object.keys(maintenanceDataToSubmit).forEach(key => {
      if (maintenanceDataToSubmit[key as keyof typeof maintenanceDataToSubmit] === undefined) {
        delete maintenanceDataToSubmit[key as keyof typeof maintenanceDataToSubmit];
      }
    });
    
    // console.log('[NewMaintenanceForm] Data to submit to service:', maintenanceDataToSubmit);
    // console.log('[NewMaintenanceForm] Attempting to call addMaintenanceMutation.mutate with:', maintenanceDataToSubmit);
    addMaintenanceMutation.mutate(maintenanceDataToSubmit);
  }

  const onValidationErrors = (errors: FieldErrors<MaintenanceFormValues>) => {
    console.error('[NewMaintenanceForm] Validation Errors:', errors);
  };

  const activeVehicles = vehicles.filter(v => v.status === 'active');

  return (
    <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
            <CardTitle className="flex items-center text-xl">
                <WrenchIcon className="mr-2 h-6 w-6 text-primary" />
                Detalhes da Manutenção
            </CardTitle>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onValidationErrors)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="vehicleId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Veículo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o veículo" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {activeVehicles.map(v => (
                                <SelectItem key={v.id} value={v.id}>
                                {v.plate} - {v.make} {v.model} ({v.status === 'active' ? 'Ativo' : v.status === 'maintenance' ? 'Em Manutenção' : 'Inativo'})
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
                            if (val !== 'date') form.setValue('scheduledDate', undefined, { shouldValidate: true });
                            if (val !== 'km') form.setValue('scheduledKm', undefined, { shouldValidate: true });
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
                                    date < new Date(new Date().setHours(0,0,0,0)) 
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

                <FormField
                    control={form.control}
                    name="cost"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Custo Estimado (R$) (Opcional)</FormLabel>
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
                    <Button 
                        type="submit" 
                        className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" 
                        disabled={addMaintenanceMutation.isPending || form.formState.isSubmitting}
                        // onClick={() => console.log('[NewMaintenanceForm] Botão "Agendar Manutenção" CLICADO!')}
                    >
                        {addMaintenanceMutation.isPending || form.formState.isSubmitting ? 'Agendando...' : <><SaveIcon className="mr-2 h-4 w-4" /> Agendar Manutenção</>}
                    </Button>
                </CardFooter>
            </form>
            </Form>
        </CardContent>
    </Card>
  );
}

    
