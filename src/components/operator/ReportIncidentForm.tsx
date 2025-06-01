
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
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, SendIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import type { Incident } from '@/lib/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addIncident as addIncidentService } from '@/lib/services/incidentService';


const incidentFormSchema = z.object({
  description: z.string().min(10, { message: "A descrição deve ter pelo menos 10 caracteres." }).max(500, { message: "A descrição não pode exceder 500 caracteres." }),
  date: z.date({ required_error: "A data da ocorrência é obrigatória." }),
});

type IncidentFormValues = z.infer<typeof incidentFormSchema>;

interface ReportIncidentFormProps {
  vehicleId: string;
  operatorId: string;
  operatorName: string;
  onFormSubmit: () => void; 
}

export function ReportIncidentForm({ vehicleId, operatorId, operatorName, onFormSubmit }: ReportIncidentFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentFormSchema),
    defaultValues: {
      description: '',
      date: new Date(),
    },
  });

  const addIncidentMutation = useMutation({
    mutationFn: (values: IncidentFormValues) => {
      const newIncidentData: Omit<Incident, 'id' | 'date'> & { date: Date } = {
        vehicleId,
        operatorId,
        operatorName,
        description: values.description,
        date: values.date, 
        status: 'reported', 
      };
      return addIncidentService(newIncidentData);
    },
    onSuccess: () => {
      toast({
        title: 'Ocorrência Registrada!',
        description: 'Sua ocorrência foi enviada para análise.',
      });
      queryClient.invalidateQueries({ queryKey: ['incidents'] }); // For admin view
      // Potentially invalidate operator specific incident queries if any
      onFormSubmit(); 
      form.reset();
    },
    onError: (error: Error) => {
       toast({
        variant: 'destructive',
        title: 'Erro ao Registrar Ocorrência',
        description: error.message || 'Não foi possível registrar a ocorrência.',
      });
    }
  });


  function onSubmit(values: IncidentFormValues) {
    addIncidentMutation.mutate(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição da Ocorrência</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Descreva detalhadamente o que aconteceu, incluindo danos, problemas mecânicos, ou outras observações relevantes sobre o veículo."
                  className="resize-none"
                  rows={5}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Data da Ocorrência</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={`w-full pl-3 text-left font-normal ${
                        !field.value && "text-muted-foreground"
                      }`}
                    >
                      {field.value ? (
                        format(field.value, "PPP", { locale: ptBR })
                      ) : (
                        <span>Escolha uma data</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date("2000-01-01") // Allow more historical dates
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={addIncidentMutation.isPending}>
          {addIncidentMutation.isPending ? 'Registrando...' : <><SendIcon className="mr-2 h-4 w-4" /> Registrar Ocorrência</>}
        </Button>
      </form>
    </Form>
  );
}
