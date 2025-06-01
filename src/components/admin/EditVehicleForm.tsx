
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
import { CalendarIcon, SaveIcon, CarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Vehicle } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateVehicle } from '@/lib/services/vehicleService';

const vehicleFormSchema = z.object({
  model: z.string().min(1, "Modelo é obrigatório.").max(50, "Modelo deve ter no máximo 50 caracteres."),
  make: z.string().min(1, "Marca é obrigatória.").max(50, "Marca deve ter no máximo 50 caracteres."),
  year: z.preprocess(
    (val) => (String(val).trim() === '' ? NaN : Number(String(val).replace(/[^0-9]/g, ''))),
    z.number({ required_error: "Ano é obrigatório."})
      .min(1900, "Ano deve ser igual ou maior que 1900.")
      .max(new Date().getFullYear() + 5, `Ano não pode ser maior que ${new Date().getFullYear() + 5}.`)
  ),
  acquisitionDate: z.date({
    required_error: 'Data de aquisição é obrigatória.',
    invalid_type_error: "Formato de data inválido.",
  }),
  status: z.enum(['active', 'maintenance', 'inactive'], {
    required_error: 'Status é obrigatório.',
  }),
  imageUrl: z.string().url({ message: "URL da imagem inválida." }).optional().or(z.literal('')),
  mileage: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : Number(String(val).replace(/\./g, '').replace(',', '.'))),
    z.number({ invalid_type_error: "KM deve ser um número." })
      .min(0, "KM não pode ser negativa.")
      .optional()
  ),
});

type VehicleFormValues = z.infer<typeof vehicleFormSchema>;

interface EditVehicleFormProps {
  vehicle: Vehicle;
  onFormSubmitSuccess: () => void;
}

export function EditVehicleForm({ vehicle, onFormSubmitSuccess }: EditVehicleFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      model: vehicle.model,
      make: vehicle.make,
      year: vehicle.year, // Already a number
      acquisitionDate: vehicle.acquisitionDate ? parseISO(vehicle.acquisitionDate) : new Date(),
      status: vehicle.status,
      imageUrl: vehicle.imageUrl ?? '',
      mileage: vehicle.mileage ?? ('' as any), // Initialize with empty string for controlled input if possibly undefined
    },
  });

  const updateVehicleMutation = useMutation<void, Error, { id: string; data: Partial<Omit<Vehicle, 'id'| 'plate'>> }>({
    mutationFn: ({ id, data }) => updateVehicle(id, data),
    onSuccess: () => {
      toast({
        title: 'Veículo Atualizado!',
        description: `Os dados do veículo ${vehicle.plate} foram atualizados com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle', vehicle.id] });
      onFormSubmitSuccess();
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao Atualizar',
        description: error.message || 'Não foi possível atualizar o veículo.',
      });
    },
  });

  function onSubmit(values: VehicleFormValues) {
    const dataToUpdate: Partial<Omit<Vehicle, 'id' | 'plate'>> = {
      ...values,
      year: Number(values.year), // Zod preprocess handles conversion
      acquisitionDate: format(values.acquisitionDate, 'yyyy-MM-dd'),
      mileage: values.mileage === '' || values.mileage === undefined || values.mileage === null ? undefined : Number(values.mileage), // Zod preprocess handles this
    };
    updateVehicleMutation.mutate({ id: vehicle.id, data: dataToUpdate });
  }

  return (
    <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
            <CardTitle className="flex items-center text-xl">
                <CarIcon className="mr-2 h-6 w-6 text-primary" />
                Informações do Veículo: {vehicle.plate}
            </CardTitle>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                 <FormField
                    control={form.control}
                    name="plate"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Placa (Não editável)</FormLabel>
                        <FormControl>
                            <Input {...field} value={vehicle.plate} disabled className="bg-muted/50" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />


                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <FormField
                    control={form.control}
                    name="make"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Marca</FormLabel>
                        <FormControl>
                        <Input placeholder="Ex: Mercedes-Benz" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Modelo</FormLabel>
                        <FormControl>
                        <Input placeholder="Ex: Sprinter" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Ano</FormLabel>
                        <FormControl>
                        <Input type="number" placeholder="Ex: 2023" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value)} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="mileage"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Quilometragem (KM)</FormLabel>
                        <FormControl>
                        <Input type="number" placeholder="Ex: 120500" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value)} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                </div>
                
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="acquisitionDate"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Data de Aquisição</FormLabel>
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
                                    date > new Date() || date < new Date("1900-01-01")
                                }
                                initialFocus
                                />
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Selecione o status" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="active">Ativo</SelectItem>
                                <SelectItem value="maintenance">Em Manutenção</SelectItem>
                                <SelectItem value="inactive">Inativo</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>

                <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>URL da Imagem (Opcional)</FormLabel>
                    <FormControl>
                        <Input placeholder="https://exemplo.com/imagem.jpg" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <CardFooter className="px-0 pt-6">
                    <Button type="submit" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={updateVehicleMutation.isPending}>
                         {updateVehicleMutation.isPending ? 'Salvando...' : <><SaveIcon className="mr-2 h-4 w-4" /> Salvar Alterações</>}
                    </Button>
                </CardFooter>
            </form>
            </Form>
        </CardContent>
    </Card>
  );
}

    