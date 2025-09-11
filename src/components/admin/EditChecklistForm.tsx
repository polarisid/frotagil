
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
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { useToast } from '@/hooks/use-toast';
import type { Vehicle, Checklist } from '@/lib/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateChecklist } from '@/lib/services/checklistService';
import { GaugeIcon, RouteIcon, SaveIcon } from 'lucide-react';
import Link from 'next/link';

const editChecklistSchema = z.object({
  mileage: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : Number(String(val).replace(/\./g, ''))),
    z.number({ required_error: "KM é obrigatório." }).min(0, "KM não pode ser negativo.")
  ),
  routeDescription: z.string().max(100, { message: "Descrição da rota não pode exceder 100 caracteres." }).optional(),
  observations: z.string().max(500, { message: "Observações devem ter no máximo 500 caracteres." }).optional(),
});

type EditChecklistFormValues = z.infer<typeof editChecklistSchema>;

interface EditChecklistFormProps {
  checklist: Checklist;
  vehicle: Vehicle;
  onFormSubmitSuccess: () => void;
}

export function EditChecklistForm({ checklist, vehicle, onFormSubmitSuccess }: EditChecklistFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditChecklistFormValues>({
    resolver: zodResolver(editChecklistSchema),
    defaultValues: {
      mileage: checklist.mileage,
      routeDescription: checklist.routeDescription || '',
      observations: checklist.observations || '',
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: Partial<Checklist>) => updateChecklist(checklist.id, values),
    onSuccess: () => {
      toast({
        title: "Checklist Atualizado",
        description: "Os dados do checklist foram atualizados com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      queryClient.invalidateQueries({ queryKey: ['checklist', checklist.id] });
      onFormSubmitSuccess();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao Atualizar",
        description: error.message,
      });
    },
  });

  function onSubmit(values: EditChecklistFormValues) {
    updateMutation.mutate({
      mileage: values.mileage,
      routeDescription: values.routeDescription,
      observations: values.observations,
    });
  }

  return (
    <Card className="max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle>Editar Checklist</CardTitle>
        <CardDescription>Você pode editar a quilometragem, rota e observações. Os itens marcados não são editáveis.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="mileage"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center">
                    <GaugeIcon className="mr-2 h-5 w-5 text-primary" />
                    <FormLabel>Quilometragem (KM)</FormLabel>
                  </div>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="routeDescription"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center">
                    <RouteIcon className="mr-2 h-5 w-5 text-primary" />
                    <FormLabel>Descrição da Rota (Opcional)</FormLabel>
                  </div>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
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
                  <FormLabel>Observações Adicionais</FormLabel>
                  <FormControl>
                    <Textarea className="resize-none" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/checklists">Cancelar</Link>
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : <><SaveIcon className="mr-2 h-4 w-4" /> Salvar Alterações</>}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
