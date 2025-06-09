
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SignaturePad } from './SignaturePad';
import type { Vehicle, Checklist, ChecklistItem as ChecklistItemType, ChecklistItemDefinition } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { PrinterIcon, SendIcon, FilePenLineIcon, GaugeIcon, Undo2Icon, RouteIcon, AlertTriangleIcon, Loader2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { addChecklist as addChecklistService } from '@/lib/services/checklistService';
import { updateVehicle as updateVehicleService, returnVehicle } from '@/lib/services/vehicleService';
import { getChecklistItemDefinitions } from '@/lib/services/checklistDefinitionService';
import jsPDF from 'jspdf';
import { format as formatDateFn } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEffect, useMemo } from 'react';
import { Skeleton } from '../ui/skeleton';
import { Alert, AlertTitle, AlertDescription as UIDescription } from '../ui/alert';

// Function to create the schema Zod dinamicamente
const createFormSchema = (definitions: ChecklistItemDefinition[]) => {
    const schemaObject: any = {};
    definitions.forEach(item => {
        schemaObject[item.itemId] = z.union([z.literal(true), z.literal(false)], {
            required_error: `Selecione Sim ou Não para: "${item.label}"`,
            invalid_type_error: "Selecione uma opção válida (Sim ou Não).",
        });
    });

    schemaObject.mileage = z.preprocess(
      (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).replace(/\./g, ''))),
      z.number({ required_error: "KM é obrigatório." }).positive({ message: "KM deve ser um número positivo." })
    );
    schemaObject.routeDescription = z.string().max(100, { message: "Descrição da rota não pode exceder 100 caracteres." }).optional();
    schemaObject.observations = z.string().max(500, { message: "Observações devem ter no máximo 500 caracteres." }).optional();
    schemaObject.signature = z.string().min(3, { message: 'Assinatura é obrigatória.' });
    return z.object(schemaObject);
};


interface ChecklistFormProps {
  vehicle: Vehicle;
  existingChecklist?: Checklist;
  currentOperatorName: string;
  currentOperatorId: string;
}

// Helper function to generate defaultValues dynamically
const getDynamicDefaultValues = (
  definitions: ChecklistItemDefinition[],
  existingData?: Checklist,
  operatorName?: string,
  currentMileage?: number // Changed from vehicle.mileage to a direct param
) => {
  const defaultVals: any = {};
  definitions.forEach(itemDef => {
    const existingItem = existingData?.items.find(i => i.id === itemDef.itemId);
    // Ensure that even if existingItem.value is null, it's treated as undefined for radio group state
    defaultVals[itemDef.itemId] = existingItem?.value === null ? undefined : existingItem?.value;
  });
  defaultVals.mileage = existingData?.mileage ?? currentMileage ?? undefined;
  defaultVals.routeDescription = existingData?.routeDescription ?? '';
  defaultVals.observations = existingData?.observations ?? '';
  defaultVals.signature = existingData?.signature ?? operatorName ?? '';
  return defaultVals;
};


export function ChecklistForm({ vehicle, existingChecklist, currentOperatorName, currentOperatorId }: ChecklistFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: activeItemDefinitions, isLoading: definitionsLoading, error: queryError } = useQuery<ChecklistItemDefinition[], Error>({
    queryKey: ['checklistItemDefinitions', true], // Fetch only active items
    queryFn: () => getChecklistItemDefinitions(true),
    staleTime: 0, // Always consider data stale to force refetch after invalidation
  });
  
  const formSchema = useMemo(() => {
    if (activeItemDefinitions && activeItemDefinitions.length > 0) {
      return createFormSchema(activeItemDefinitions);
    }
    // Return a minimal schema or handle appropriately if definitions are not yet loaded
    // This base schema helps prevent errors before definitions are loaded.
    return z.object({
      mileage: z.preprocess(
        (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).replace(/\./g, ''))),
        z.number({ required_error: "KM é obrigatório." }).positive({ message: "KM deve ser um número positivo." })
      ),
      routeDescription: z.string().max(100, { message: "Descrição da rota não pode exceder 100 caracteres." }).optional(),
      observations: z.string().max(500, { message: "Observações devem ter no máximo 500 caracteres." }).optional(),
      signature: z.string().min(3, { message: 'Assinatura é obrigatória.' })
    });
  }, [activeItemDefinitions]);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    // Default values will be set in useEffect once definitions are loaded
    defaultValues: {},
    disabled: !!existingChecklist || definitionsLoading,
  });

  useEffect(() => {
    if (definitionsLoading || !activeItemDefinitions) return;

    const dynamicDefaults = getDynamicDefaultValues(
      activeItemDefinitions,
      existingChecklist,
      currentOperatorName,
      vehicle.mileage
    );
    form.reset(dynamicDefaults);
  }, [definitionsLoading, activeItemDefinitions, existingChecklist, currentOperatorName, vehicle.mileage, form]);


  const addChecklistMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!activeItemDefinitions) throw new Error("Checklist items not loaded.");
      const itemsForDb: ChecklistItemType[] = activeItemDefinitions.map(itemDef => ({
        id: itemDef.itemId,
        label: itemDef.label,
        value: values[itemDef.itemId as keyof typeof values] as boolean, // Cast as boolean, ensure schema enforces this
      }));

      const newChecklistData: Omit<Checklist, 'id' | 'date'> & { date: Date } = {
        vehicleId: vehicle.id,
        operatorId: currentOperatorId,
        operatorName: currentOperatorName,
        date: new Date(),
        items: itemsForDb,
        mileage: values.mileage!, // Schema ensures it's a number
        routeDescription: values.routeDescription ?? undefined,
        observations: values.observations ?? '',
        signature: values.signature!, // Schema ensures it's a string
      };
      await addChecklistService(newChecklistData);
      await updateVehicleService(vehicle.id, { mileage: values.mileage! });
      return newChecklistData;
    },
    onSuccess: (data) => {
      toast({
        title: 'Checklist Enviado!',
        description: `Checklist para ${vehicle.plate} foi registrado. KM: ${data.mileage?.toLocaleString('pt-BR')}`,
      });
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      queryClient.invalidateQueries({ queryKey: ['operatorChecklists', currentOperatorId] });
      queryClient.invalidateQueries({ queryKey: ['vehicle', vehicle.id] });
      queryClient.invalidateQueries({ queryKey: ['checklistForCurrentPossession', vehicle.id, currentOperatorId, vehicle.pickedUpDate] });
      router.push('/operator/dashboard');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao Enviar Checklist',
        description: error.message || 'Não foi possível registrar o checklist.',
      });
    },
  });

  const returnVehicleMutation = useMutation({
    mutationFn: () => returnVehicle(vehicle.id, currentOperatorId, vehicle.mileage ?? 0),
    onSuccess: () => {
      toast({
        title: "Veículo Devolvido",
        description: `O veículo ${vehicle.plate} foi devolvido e está disponível. O checklist não foi salvo.`,
      });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['checklistForCurrentPossession', vehicle.id, currentOperatorId, vehicle.pickedUpDate] });
      queryClient.invalidateQueries({ queryKey: ['vehicleUsageLogs'] });
      router.push('/operator/dashboard');
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao Devolver Veículo",
        description: error.message || "Não foi possível devolver o veículo ao cancelar o checklist.",
      });
    },
  });


  function onSubmit(values: z.infer<typeof formSchema>) {
    if (existingChecklist) {
      toast({ title: 'Visualização de Checklist', description: `Checklist para ${vehicle.plate} carregado.` });
      return;
    }
    if (vehicle.mileage !== undefined && values.mileage! < vehicle.mileage) {
        form.setError("mileage", {
            type: "manual",
            message: `KM atual não pode ser menor que o último KM registrado (${vehicle.mileage.toLocaleString('pt-BR')}).`
        });
        return;
    }
    addChecklistMutation.mutate(values);
  }

  function handleExportPdf() {
    if (!activeItemDefinitions && !existingChecklist) {
        toast({variant: "destructive", title: "Erro ao Exportar", description: "Definições do checklist não carregadas."});
        return;
    }
    const itemsToExport: ChecklistItemType[] = existingChecklist
      ? existingChecklist.items
      : activeItemDefinitions!.map(itemDef => ({
          id: itemDef.itemId,
          label: itemDef.label,
          value: form.getValues(itemDef.itemId as keyof z.infer<typeof formSchema>) as boolean | null,
        }));

    const dataToExport = existingChecklist || {
        ...form.getValues(),
        items: itemsToExport,
        date: new Date().toISOString(),
        operatorName: currentOperatorName,
        signature: form.getValues("signature"),
        routeDescription: form.getValues("routeDescription")
    };

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const leftMargin = 15;
    const rightMargin = 15;
    const topMargin = 15;
    const bottomMargin = 20;
    const contentWidth = pageWidth - leftMargin - rightMargin;
    let yPos = topMargin;
    const lineHeight = 5;
    const cellPadding = 2;

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('FrotaÁgil', pageWidth - rightMargin, topMargin, { align: 'right' });
    yPos += 10;

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Relatório de Checklist de Veículo', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Veículo: ${vehicle.make} ${vehicle.model} (Placa: ${vehicle.plate})`, leftMargin, yPos);
    yPos += 7;
    doc.text(`Operador: ${dataToExport.operatorName}`, leftMargin, yPos);
    yPos += 7;
    doc.text(`Data: ${formatDateFn(new Date(dataToExport.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, leftMargin, yPos);
    yPos += 7;
    doc.text(`KM Registrado: ${dataToExport.mileage?.toLocaleString('pt-BR') || 'N/A'} km`, leftMargin, yPos);
    yPos += 7;
    if (dataToExport.routeDescription) {
      doc.text(`Descrição da Rota: ${dataToExport.routeDescription}`, leftMargin, yPos);
      yPos += 7;
    }
    yPos += 5; // Extra space before items

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Itens Verificados:', leftMargin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    const itemColWidth = contentWidth * 0.80;
    const statusColWidth = contentWidth * 0.20;
    const itemColX = leftMargin;
    const statusColX = leftMargin + itemColWidth;

    doc.text('Item', itemColX + cellPadding, yPos);
    doc.text('Status', statusColX + cellPadding, yPos);
    yPos += 5;
    doc.setLineWidth(0.3);
    doc.line(leftMargin, yPos, pageWidth - rightMargin, yPos);
    yPos += 3;
    doc.setFont(undefined, 'normal');

    const drawItemRowPdf = (itemLabel: string, itemValue: boolean | null) => {
      const itemLabelLines = doc.splitTextToSize(itemLabel, itemColWidth - (cellPadding * 2));
      const rowHeight = (itemLabelLines.length * lineHeight) + (cellPadding * 2);

      if (yPos + rowHeight + 3 > pageHeight - bottomMargin) {
        doc.addPage();
        yPos = topMargin;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('FrotaÁgil', pageWidth - rightMargin, topMargin, { align: 'right' });
        yPos += 10;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Item', itemColX + cellPadding, yPos);
        doc.text('Status', statusColX + cellPadding, yPos);
        yPos += 5;
        doc.setLineWidth(0.3);
        doc.line(leftMargin, yPos, pageWidth - rightMargin, yPos);
        yPos += 3;
        doc.setFont(undefined, 'normal');
      }
      
      const textY = yPos + cellPadding + (lineHeight * 0.7);

      doc.text(itemLabelLines, itemColX + cellPadding, textY);

      let statusTextWithIcon = '- N/A';
      doc.setFont(undefined, 'bold');
      if (itemValue === true) {
        doc.setTextColor(0, 100, 0);
        statusTextWithIcon = "✓ Sim";
      } else if (itemValue === false) {
        doc.setTextColor(200, 0, 0);
        statusTextWithIcon = "✗ Não";
      } else {
        doc.setTextColor(105, 105, 105);
      }
      
      doc.text(statusTextWithIcon, statusColX + cellPadding, textY);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);

      yPos += rowHeight;
      doc.setLineWidth(0.1);
      doc.line(leftMargin, yPos, pageWidth - rightMargin, yPos);
      yPos += 3;
    };

    itemsToExport.forEach(item => {
        drawItemRowPdf(item.label, item.value);
    });
    
    yPos += 5;

    if (dataToExport.observations) {
      const obsTitleHeight = 7;
      const obsTextHeight = doc.splitTextToSize(dataToExport.observations, contentWidth).length * lineHeight;
      if (yPos + obsTitleHeight + obsTextHeight + 5 > pageHeight - bottomMargin) {
          doc.addPage(); yPos = topMargin;
          doc.setFontSize(10); doc.setFont(undefined, 'bold');
          doc.text('FrotaÁgil', pageWidth - rightMargin, topMargin, { align: 'right' });
          yPos += 10;
      }
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Observações:', leftMargin, yPos);
      yPos += obsTitleHeight;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      const splitObservations = doc.splitTextToSize(dataToExport.observations, contentWidth);
      doc.text(splitObservations, leftMargin, yPos);
      yPos += obsTextHeight + 5;
    }

    const sigTitleHeight = 7;
    const sigTextHeight = lineHeight;
    if (yPos + sigTitleHeight + sigTextHeight + 5 > pageHeight - bottomMargin) {
        doc.addPage(); yPos = topMargin;
        doc.setFontSize(10); doc.setFont(undefined, 'bold');
        doc.text('FrotaÁgil', pageWidth - rightMargin, topMargin, { align: 'right' });
        yPos += 10;
    }
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Assinatura (Digital):', leftMargin, yPos);
    yPos += sigTitleHeight;
    doc.setFontSize(10);
    doc.setFont("courier", "normal");
    doc.text(dataToExport.signature || currentOperatorName, leftMargin, yPos);

    doc.save(`checklist-${vehicle.plate}-${formatDateFn(new Date(dataToExport.date), "yyyy-MM-dd", { locale: ptBR })}.pdf`);

    toast({
      title: 'PDF Gerado',
      description: 'O PDF do checklist foi gerado e o download deve iniciar.',
    });
  }

  const isViewing = !!existingChecklist;

  const handleCancelAndReturnVehicle = () => {
    returnVehicleMutation.mutate();
  };

  if (definitionsLoading) {
    return (
      <Card className="w-full max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <FilePenLineIcon className="mr-3 h-7 w-7 text-primary" />
            Carregando Itens do Checklist...
          </CardTitle>
          <CardDescription>
            Veículo: {vehicle.make} {vehicle.model} (Placa: {vehicle.plate})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
        <CardFooter className="pt-6 border-t mt-6">
            <Skeleton className="h-10 w-24 ml-auto" />
        </CardFooter>
      </Card>
    );
  }

  if (queryError) {
     return (
      <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
        <AlertTriangleIcon className="h-4 w-4" />
        <AlertTitle>Erro ao Carregar Itens</AlertTitle>
        <UIDescription>
          Não foi possível carregar os itens do checklist. Tente recarregar a página.
          Detalhes: {queryError.message}
        </UIDescription>
      </Alert>
    );
  }
  
  if (!activeItemDefinitions || activeItemDefinitions.length === 0) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
        <AlertTriangleIcon className="h-4 w-4" />
        <AlertTitle>Nenhum Item de Checklist Configurado</AlertTitle>
        <UIDescription>
          Não há itens de checklist ativos configurados pelo administrador. 
          Por favor, contate o administrador para adicionar itens ao checklist.
        </UIDescription>
         <Button type="button" onClick={() => router.push('/operator/dashboard')} className="mt-4" variant="outline">
            Voltar ao Dashboard
        </Button>
      </Alert>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center text-2xl">
          <FilePenLineIcon className="mr-3 h-7 w-7 text-primary" />
          {isViewing ? 'Visualizar Checklist' : 'Checklist Diário do Veículo'}
        </CardTitle>
        <CardDescription>
          Veículo: {vehicle.make} {vehicle.model} (Placa: {vehicle.plate})
          {form.getValues("mileage") !== undefined && !isViewing && <span className="block text-xs text-muted-foreground">Última KM registrada: {vehicle.mileage?.toLocaleString('pt-BR') ?? 'N/A'}</span>}
          {isViewing && existingChecklist?.mileage && <span className="block text-xs text-muted-foreground">KM registrada no checklist: {existingChecklist.mileage.toLocaleString('pt-BR')}</span>}
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {activeItemDefinitions.map(itemDef => (
              <FormField
                key={itemDef.itemId} // Use itemId which is unique string from definition
                control={form.control}
                name={itemDef.itemId as keyof z.infer<typeof formSchema>}
                render={({ field }) => (
                  <FormItem className="space-y-3 rounded-md border p-4 shadow-sm hover:bg-secondary/30 transition-colors">
                    <FormLabel>{itemDef.label}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) => field.onChange(value === 'true')}
                        value={field.value === undefined ? "" : String(field.value)}
                        className="flex space-x-4"
                        disabled={isViewing}
                      >
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <RadioGroupItem value="true" id={`${itemDef.itemId}-yes`} />
                          </FormControl>
                          <FormLabel htmlFor={`${itemDef.itemId}-yes`} className="font-normal cursor-pointer">Sim</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <RadioGroupItem value="false" id={`${itemDef.itemId}-no`} />
                          </FormControl>
                          <FormLabel htmlFor={`${itemDef.itemId}-no`} className="font-normal cursor-pointer">Não</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            <FormField
              control={form.control}
              name="mileage"
              render={({ field }) => (
                <FormItem className="rounded-md border p-4 shadow-sm">
                  <div className="flex items-center">
                     <GaugeIcon className="mr-2 h-5 w-5 text-primary" />
                    <FormLabel>Quilometragem Atual (KM)</FormLabel>
                  </div>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Ex: 123456"
                      {...field}
                      disabled={isViewing}
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
                    <Input
                      placeholder="Ex: Rota Capital, Rota PE, Entrega Cliente X"
                      {...field}
                      disabled={isViewing}
                      value={field.value ?? ''}
                    />
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
                  <FormLabel>Observações Adicionais (danos, problemas, etc.)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Relate qualquer problema identificado ou detalhe importante sobre o estado do veículo. Lembre-se de registrar uma ocorrencia para quaisquer problemas que devem ser resolvidos. "
                      className="resize-none"
                      {...field}
                      disabled={isViewing}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="signature"
              render={({ field }) => (
                <FormItem>
                  <SignaturePad
                    field={field}
                    disabled={isViewing}
                    defaultName={isViewing ? existingChecklist?.signature : currentOperatorName}
                  />
                   {isViewing && field.value && <p className="mt-2 text-sm text-muted-foreground">Assinado por: {field.value}</p>}
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-4 sm:flex-row sm:justify-end sm:space-x-2 pt-6 border-t mt-6">
            {isViewing ? (
                <>
                    <Button type="button" variant="outline" onClick={handleExportPdf} className="w-full sm:w-auto">
                        <PrinterIcon className="mr-2 h-4 w-4" />
                        Exportar PDF
                    </Button>
                    <Button type="button" onClick={() => router.back()} className="w-full sm:w-auto" variant="outline">
                        Voltar
                    </Button>
                </>
            ) : (
                <>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancelAndReturnVehicle}
                        className="w-full sm:w-auto"
                        disabled={returnVehicleMutation.isPending}
                    >
                        {returnVehicleMutation.isPending ? <><Loader2Icon className="animate-spin mr-2" /> Devolvendo...</> : <><Undo2Icon className="mr-2 h-4 w-4" /> Cancelar e Devolver Veículo</>}
                    </Button>
                    <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground sm:w-auto" disabled={addChecklistMutation.isPending || form.formState.isSubmitting}>
                        {addChecklistMutation.isPending || form.formState.isSubmitting ? <><Loader2Icon className="animate-spin mr-2" /> Enviando...</> : <><SendIcon className="mr-2 h-4 w-4" /> Enviar Checklist</>}
                    </Button>
                </>
            )}
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

