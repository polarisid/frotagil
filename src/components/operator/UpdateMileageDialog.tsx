
'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { Vehicle } from '@/lib/types';
import { GaugeIcon, SendIcon } from 'lucide-react';

interface UpdateMileageDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
  onSubmitMileage: (vehicleId: string, newMileage: number) => void;
  isSubmitting: boolean;
}

export function UpdateMileageDialog({
  isOpen,
  onOpenChange,
  vehicle,
  onSubmitMileage,
  isSubmitting,
}: UpdateMileageDialogProps) {
  // Schema é dinâmico baseado na quilometragem atual do veículo
  const getUpdateMileageSchema = (currentMileage?: number) => z.object({
    newMileage: z.preprocess(
      (val) => (String(val).trim() === "" || val === undefined || val === null ? undefined : Number(String(val).replace(/\./g, ''))),
      z.number({ required_error: "KM é obrigatório." })
        .min(currentMileage ?? 0, `KM deve ser maior ou igual à KM atual (${currentMileage?.toLocaleString('pt-BR') ?? 'N/A'}).`)
    ),
  });

  type UpdateMileageFormValues = z.infer<ReturnType<typeof getUpdateMileageSchema>>;

  const form = useForm<UpdateMileageFormValues>({
    resolver: zodResolver(getUpdateMileageSchema(vehicle?.mileage)),
    defaultValues: {
      newMileage: vehicle?.mileage ?? undefined,
    },
  });

  React.useEffect(() => {
    if (vehicle) {
      // Recriar o resolver com o schema atualizado quando o veículo ou sua quilometragem mudar
      form.reset({ newMileage: vehicle.mileage ?? undefined }, {
        keepDirty: false,
        keepErrors: false,
        keepIsValid: false,
        keepIsSubmitted: false,
        keepTouched: false,
        keepValues: false, // Forçar a reinicialização para pegar o novo defaultValues e schema
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle, vehicle?.mileage, isOpen]); // Adicionado isOpen para revalidar ao abrir


  const handleSubmit = (values: UpdateMileageFormValues) => {
    if (vehicle) {
      onSubmitMileage(vehicle.id, values.newMileage);
    }
  };

  if (!vehicle) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) form.reset({ newMileage: vehicle?.mileage ?? undefined }); // Reset on close
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <GaugeIcon className="mr-2 h-5 w-5 text-primary" />
            Atualizar KM do Veículo: {vehicle.plate}
          </DialogTitle>
          <DialogDescription>
            Informe a quilometragem atual do veículo ({vehicle.make} {vehicle.model}) antes de devolvê-lo.
            Última KM registrada: {vehicle.mileage?.toLocaleString('pt-BR') ?? 'Não registrada'}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="newMileage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nova Quilometragem (KM)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Ex: 123456"
                      {...field}
                      value={field.value ?? ''}
                      onChange={e => {
                        const rawValue = e.target.value;
                        field.onChange(rawValue === '' ? undefined : Number(rawValue));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmitting || !form.formState.isValid}>
                {isSubmitting ? 'Confirmando...' : <><SendIcon className="mr-2 h-4 w-4" /> Confirmar Devolução</>}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
