
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
import { CalendarIcon, SaveIcon, ReceiptTextIcon, UsersRoundIcon, CarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User, Vehicle, Fine } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO, isValid as isDateValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateFine as updateFineService } from '@/lib/services/fineService';
import { useEffect } from 'react';

// Schema for editing fine, similar to creation but some fields might be handled differently
const editFineFormSchema = z.object({
  operatorId: z.string(), // Will be displayed, not directly editable in this form
  vehicleId: z.string(),  // Will be displayed, not directly editable in this form
  infractionCode: z.string().min(1, "Código da infração é obrigatório.").max(50, "Código muito longo."),
  description: z.string().min(10, "Descrição deve ter no mínimo 10 caracteres.").max(255, "Descrição muito longa."),
  location: z.string().min(5, "Local é obrigatório.").max(150, "Local muito longo."),
  date: z.date({ required_error: "Data da infração é obrigatória." }),
  dueDate: z.date({ required_error: "Data de vencimento é obrigatória." }),
  amount: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : Number(String(val).replace(',', '.'))),
    z.number({ required_error: "Valor é obrigatório.", invalid_type_error: "Valor deve ser um número." })
      .positive("Valor deve ser positivo.")
  ),
  status: z.enum(['pending', 'paid', 'appealed', 'cancelled'], { required_error: "Status é obrigatório." }),
  adminNotes: z.string().max(500, "Notas muito longas.").optional(),
});

type EditFineFormValues = z.infer<typeof editFineFormSchema>;

interface EditFineFormProps {
  fine: Fine;
  operators: User[]; // Full list of operators for display, not for selection
  vehicles: Vehicle[];  // Full list of vehicles for display, not for selection
  onFormSubmitSuccess: () => void;
}

export function EditFineForm({ fine, operators, vehicles, onFormSubmitSuccess }: EditFineFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const parseDateStringOrDate = (dateInput?: string | Date): Date | undefined => {
    if (!dateInput) return undefined;
    if (dateInput instanceof Date && isDateValid(dateInput)) return dateInput;
    if (typeof dateInput === 'string') {
        // Try parsing as ISO (which is what Firestore date strings become after .toISOString())
        const date = parseISO(dateInput);
        if (isDateValid(date)) return date;
        // Fallback for other string formats if necessary, though ISO should be standard from Firestore
    }
    return undefined;
  };

  const form = useForm<EditFineFormValues>({
    resolver: zodResolver(editFineFormSchema),
    defaultValues: {
      operatorId: fine.operatorId,
      vehicleId: fine.vehicleId,
      infractionCode: fine.infractionCode,
      description: fine.description,
      location: fine.location,
      date: parseDateStringOrDate(fine.date) || new Date(),
      dueDate: parseDateStringOrDate(fine.dueDate) || new Date(),
      amount: fine.amount,
      status: fine.status, // Status should be 'pending' if this form is reachable
      adminNotes: fine.adminNotes || '',
    },
  });
  
  // Update default values if `fine` prop changes
  useEffect(() => {
    form.reset({
      operatorId: fine.operatorId,
      vehicleId: fine.vehicleId,
      infractionCode: fine.infractionCode,
      description: fine.description,
      location: fine.location,
      date: parseDateStringOrDate(fine.date) || new Date(),
      dueDate: parseDateStringOrDate(fine.dueDate) || new Date(),
      amount: fine.amount,
      status: fine.status,
      adminNotes: fine.adminNotes || '',
    });
  }, [fine, form]);


  const updateFineMutation = useMutation({
    mutationFn: (data: { id: string; fineData: Partial<Omit<Fine, 'id' | 'createdAt' | 'operatorName' | 'vehiclePlate'>> }) =>
      updateFineService(data.id, data.fineData),
    onSuccess: () => {
      toast({
        title: 'Multa Atualizada!',
        description: `A multa #${fine.id.substring(0,8)} foi atualizada com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      queryClient.invalidateQueries({ queryKey: ['fine', fine.id] });
      onFormSubmitSuccess();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao Atualizar Multa',
        description: error.message || 'Não foi possível atualizar a multa.',
      });
    },
  });

  function onSubmit(values: EditFineFormValues) {
    // operatorId and vehicleId are not part of the editable values from the form directly
    // they are part of the `fine` object.
    const { operatorId, vehicleId, ...editableValues } = values;

    const fineDataToUpdate: Partial<Omit<Fine, 'id' | 'createdAt' | 'operatorName' | 'vehiclePlate'>> = {
      ...editableValues,
      date: values.date.toISOString(), // Changed to toISOString()
      dueDate: format(values.dueDate, 'yyyy-MM-dd'),
      amount: Number(values.amount),
    };
    updateFineMutation.mutate({ id: fine.id, fineData: fineDataToUpdate });
  }
  
  const operatorDisplay = operators.find(op => op.id === fine.operatorId)?.name || fine.operatorName || 'Desconhecido';
  const vehicleDisplay = vehicles.find(v => v.id === fine.vehicleId)?.plate || fine.vehiclePlate || 'Desconhecido';


  return (
    <Card className="max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <ReceiptTextIcon className="mr-2 h-6 w-6 text-primary" />
          Editar Detalhes da Multa
        </CardTitle>
        <CardDescription>
          Modifique as informações da multa conforme necessário. O status deve ser "Pendente" para permitir edições.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <FormItem>
                    <FormLabel className="flex items-center"><CarIcon className="mr-1 h-4 w-4 text-muted-foreground"/>Veículo</FormLabel>
                    <Input value={vehicleDisplay} disabled className="bg-muted/50" />
                </FormItem>
                <FormItem>
                    <FormLabel className="flex items-center"><UsersRoundIcon className="mr-1 h-4 w-4 text-muted-foreground"/>Operador</FormLabel>
                    <Input value={operatorDisplay} disabled className="bg-muted/50" />
                </FormItem>
            </div>
            
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
                    <FormLabel>Status</FormLabel>
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
              <Button type="submit" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={updateFineMutation.isPending || form.formState.isSubmitting}>
                {updateFineMutation.isPending ? 'Salvando...' : <><SaveIcon className="mr-2 h-4 w-4" /> Salvar Alterações</>}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

