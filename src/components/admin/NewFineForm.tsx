
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
import { CalendarIcon, SaveIcon, ReceiptTextIcon, CarIcon, Loader2Icon, UsersRoundIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User, Vehicle, Fine } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addFine as addFineService } from '@/lib/services/fineService';
import { getOperatorForVehicleAtTime } from '@/lib/services/vehicleUsageLogService';
import { useEffect, useState, useCallback } from 'react';

const fineFormSchema = z.object({
  operatorId: z.string({ required_error: "Selecione um operador." }),
  vehicleId: z.string({ required_error: "Selecione um veículo." }),
  infractionCode: z.string().min(1, "Código da infração é obrigatório.").max(50, "Código muito longo."),
  description: z.string().min(10, "Descrição deve ter no mínimo 10 caracteres.").max(255, "Descrição muito longa."),
  location: z.string().min(5, "Local é obrigatório.").max(150, "Local muito longo."),
  date: z.date({ required_error: "Data da infração é obrigatória." }),
  dueDate: z.date({ required_error: "Data de vencimento é obrigatória." }),
  amount: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : Number(String(val).replace(',', '.'))), // Allow comma as decimal separator
    z.number({ required_error: "Valor é obrigatório.", invalid_type_error: "Valor deve ser um número." })
      .positive("Valor deve ser positivo.")
  ),
  status: z.enum(['pending', 'paid', 'appealed', 'cancelled'], { required_error: "Status é obrigatório." }),
  adminNotes: z.string().max(500, "Notas muito longas.").optional(),
});

type FineFormValues = z.infer<typeof fineFormSchema>;

interface NewFineFormProps {
  operators: User[];
  vehicles: Vehicle[];
  onFormSubmitSuccess: () => void;
}

export function NewFineForm({ operators, vehicles, onFormSubmitSuccess }: NewFineFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFetchingOperator, setIsFetchingOperator] = useState(false);

  const form = useForm<FineFormValues>({
    resolver: zodResolver(fineFormSchema),
    defaultValues: {
      operatorId: undefined,
      vehicleId: undefined,
      infractionCode: '',
      description: '',
      location: '',
      date: new Date(),
      dueDate: new Date(),
      amount: undefined,
      status: 'pending',
      adminNotes: '',
    },
  });

  const selectedVehicleId = form.watch('vehicleId');
  const infractionDate = form.watch('date');

  const fetchAndSetOperator = useCallback(async (vehicleIdParam?: string, dateParam?: Date) => {
    if (!vehicleIdParam || !dateParam) {
      if (form.getValues('operatorId') !== undefined) {
        // form.setValue('operatorId', undefined, { shouldValidate: true });
      }
      return;
    }
    setIsFetchingOperator(true);
    try {
      const operatorId = await getOperatorForVehicleAtTime(vehicleIdParam, dateParam.toISOString());
      const currentFormOperatorId = form.getValues('operatorId');

      if (operatorId) {
        const operatorExistsInList = operators.some(op => op.id === operatorId);
        if (operatorExistsInList) {
          if (currentFormOperatorId !== operatorId) {
            form.setValue('operatorId', operatorId, { shouldValidate: true });
            toast({
              title: 'Operador Identificado',
              description: `O operador ${operators.find(op => op.id === operatorId)?.name || 'desconhecido'} foi selecionado automaticamente.`,
              className: "bg-green-100 dark:bg-green-900",
            });
          }
        } else {
          console.warn(`Operador ${operatorId} encontrado no histórico, mas não está na lista de operadores ativos/disponíveis.`);
          if (currentFormOperatorId !== undefined) {
            form.setValue('operatorId', undefined, { shouldValidate: true });
            toast({
              title: 'Operador do Histórico Indisponível',
              description: `O operador associado ao veículo nesta data/hora não está na lista de seleção. Por favor, selecione manualmente.`,
            });
          }
        }
      } else {
        if (currentFormOperatorId !== undefined) {
          form.setValue('operatorId', undefined, { shouldValidate: true });
          toast({
              title: 'Operador Não Encontrado',
              description: `Nenhum operador associado a este veículo/data no histórico. Selecione manualmente.`,
          });
        }
      }
    } catch (error) {
      console.error("Erro ao buscar operador:", error);
      toast({
        variant: "destructive",
        title: "Erro ao Buscar Operador",
        description: "Não foi possível identificar o operador automaticamente.",
      });
      if (form.getValues('operatorId') !== undefined) {
          form.setValue('operatorId', undefined, { shouldValidate: true });
      }
    } finally {
      setIsFetchingOperator(false);
    }
  }, [form, toast, operators]);


  useEffect(() => {
    if (selectedVehicleId && infractionDate) {
      fetchAndSetOperator(selectedVehicleId, infractionDate);
    } else if (!selectedVehicleId || !infractionDate) {
      // If vehicle or date is cleared, clear operator
      if (form.getValues('operatorId') !== undefined) {
         // form.setValue('operatorId', undefined, { shouldValidate: true });
      }
    }
  }, [selectedVehicleId, infractionDate, fetchAndSetOperator, form]);

  const addFineMutation = useMutation({
    mutationFn: addFineService,
    onSuccess: (data) => {
      toast({
        title: 'Multa Cadastrada!',
        description: `Multa para ${data.vehiclePlate} (Operador: ${data.operatorName}) foi cadastrada.`,
      });
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      onFormSubmitSuccess();
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao Cadastrar Multa',
        description: error.message || 'Não foi possível cadastrar a multa.',
      });
    },
  });

  function onSubmit(values: FineFormValues) {
    const selectedOperator = operators.find(op => op.id === values.operatorId);
    const selectedVehicle = vehicles.find(veh => veh.id === values.vehicleId);

    if (!selectedOperator || !selectedVehicle) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Operador ou veículo selecionado inválido.' });
      return;
    }

    const fineDataToSubmit: Omit<Fine, 'id' | 'createdAt'> = {
      ...values,
      operatorName: selectedOperator.name,
      vehiclePlate: selectedVehicle.plate,
      date: values.date.toISOString(), // Changed to toISOString()
      dueDate: format(values.dueDate, 'yyyy-MM-dd'),
      amount: values.amount,
    };
    addFineMutation.mutate(fineDataToSubmit);
  }

  return (
    <Card className="max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <ReceiptTextIcon className="mr-2 h-6 w-6 text-primary" />
          Detalhes da Nova Multa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
               <FormField
                control={form.control}
                name="vehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><CarIcon className="mr-1 h-4 w-4 text-muted-foreground"/>Veículo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.plate} - {v.make} {v.model}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data e Hora da Infração</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP HH:mm", { locale: ptBR }) : <span>Escolha data e hora</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        <Input type="time"
                            defaultValue={field.value ? format(field.value, "HH:mm") : ""}
                            onChange={(e) => {
                                const time = e.target.value;
                                if (field.value && time) {
                                    const [hours, minutes] = time.split(':').map(Number);
                                    const newDate = new Date(field.value);
                                    newDate.setHours(hours, minutes);
                                    field.onChange(newDate);
                                }
                            }}
                            className="mt-2 border-t border-border p-2"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
                control={form.control}
                name="operatorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                        <UsersRoundIcon className="mr-1 h-4 w-4 text-muted-foreground"/>Operador Responsável
                        {isFetchingOperator && <Loader2Icon className="ml-2 h-4 w-4 animate-spin text-primary" />}
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isFetchingOperator}>
                      <FormControl><SelectTrigger><SelectValue placeholder={isFetchingOperator ? "Buscando..." : "Selecione o operador"} /></SelectTrigger></FormControl>
                      <SelectContent>
                        {operators.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />


            <FormField
              control={form.control}
              name="infractionCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código da Infração</FormLabel>
                  <FormControl><Input placeholder="Ex: 501-00" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição da Infração</FormLabel>
                  <FormControl><Textarea placeholder="Ex: Transitar em velocidade superior à máxima permitida em até 20%" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Local da Infração</FormLabel>
                  <FormControl><Input placeholder="Ex: Av. Brasil, km 10, Rio de Janeiro - RJ" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
             <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor da Multa (R$)</FormLabel>
                    <FormControl><Input type="number" placeholder="Ex: 195.23" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value.replace(',', '.')))} step="0.01" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Vencimento</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Escolha a data</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status Inicial</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="paid">Paga</SelectItem>
                        <SelectItem value="appealed">Recorrida</SelectItem>
                        <SelectItem value="cancelled">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <FormField
              control={form.control}
              name="adminNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas do Administrador (Opcional)</FormLabel>
                  <FormControl><Textarea placeholder="Observações internas sobre a multa..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <CardFooter className="px-0 pt-6">
              <Button type="submit" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={addFineMutation.isPending || isFetchingOperator}>
                {addFineMutation.isPending ? 'Salvando...' : <><SaveIcon className="mr-2 h-4 w-4" /> Salvar Multa</>}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

