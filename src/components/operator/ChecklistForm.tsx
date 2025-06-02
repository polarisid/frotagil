
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
import type { Vehicle, Checklist, ChecklistItem as ChecklistItemType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { PrinterIcon, SendIcon, FilePenLineIcon, GaugeIcon, Undo2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addChecklist as addChecklistService } from '@/lib/services/checklistService';
import { updateVehicle as updateVehicleService, returnVehicle } from '@/lib/services/vehicleService';
import jsPDF from 'jspdf';
import { format as formatDateFn } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Definindo os itens de checklist centralmente
const checklistItemsDefinition: { name: keyof Omit<z.infer<ReturnType<typeof createFormSchema>>, 'mileage' | 'observations' | 'signature'>; label: string; id: string }[] = [
  { name: "tires", label: "Pneus calibrados e em bom estado?", id: "tires" },
  { name: "lights", label: "Luzes (faróis, lanternas, setas, freio) funcionando?", id: "lights" },
  { name: "brakes", label: "Freios (pedal e de mão) com resposta normal?", id: "brakes" },
  { name: "oilLevel", label: "Nível de óleo do motor verificado e normal?", id: "oilLevel" },
  { name: "waterLevel", label: "Nível da água do radiador verificado e normal?", id: "waterLevel" },
  { name: "brakeFluid", label: "Nível do fluido de freio verificado e normal?", id: "brakeFluid" },
  { name: "fireExtinguisher", label: "Extintor de incêndio válido e pressurizado?", id: "fireExtinguisher" },
  { name: "warningTriangle", label: "Triângulo de sinalização presente e em bom estado?", id: "warningTriangle" },
  { name: "jackAndWrench", label: "Macaco e chave de roda presentes e funcionais?", id: "jackAndWrench" },
  { name: "vehicleDocuments", label: "Documentação do veículo (CRLV) presente e válida?", id: "vehicleDocuments" },
  { name: "interiorCleanliness", label: "Limpeza interna do veículo satisfatória?", id: "interiorCleanliness" },
  { name: "exteriorCleanliness", label: "Limpeza externa do veículo satisfatória?", id: "exteriorCleanliness" },
];

// Função para criar o schema Zod dinamicamente
const createFormSchema = () => {
    const schemaObject: any = {};
    checklistItemsDefinition.forEach(item => {
        // Alterado para permitir Sim ou Não obrigatoriamente
        schemaObject[item.name] = z.union([z.literal(true), z.literal(false)], {
            required_error: `Selecione Sim ou Não para: "${item.label}"`,
            invalid_type_error: "Selecione uma opção válida (Sim ou Não).",
        });
    });

    schemaObject.mileage = z.preprocess(
      (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).replace(/\./g, ''))),
      z.number({ required_error: "KM é obrigatório." }).positive({ message: "KM deve ser um número positivo." })
    );
    schemaObject.observations = z.string().max(500, { message: "Observações devem ter no máximo 500 caracteres." }).optional();
    schemaObject.signature = z.string().min(3, { message: 'Assinatura é obrigatória.' });
    return z.object(schemaObject);
};

const formSchema = createFormSchema();


interface ChecklistFormProps {
  vehicle: Vehicle;
  existingChecklist?: Checklist;
  currentOperatorName: string;
  currentOperatorId: string;
}

export function ChecklistForm({ vehicle, existingChecklist, currentOperatorName, currentOperatorId }: ChecklistFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const defaultValuesFromExisting = existingChecklist ?
    checklistItemsDefinition.reduce((acc, itemDef) => {
      const foundItem = existingChecklist.items.find(i => i.id === itemDef.id);
      acc[itemDef.name as keyof typeof acc] = foundItem?.value ?? undefined; // Permitir undefined para forçar escolha
      return acc;
    }, {} as Record<string, boolean | undefined>)
  : checklistItemsDefinition.reduce((acc, itemDef) => {
      acc[itemDef.name as keyof typeof acc] = undefined; // Todos os itens começam como não selecionados
      return acc;
    }, {} as Record<string, boolean | undefined>);

  const defaultValues = existingChecklist ? {
    ...defaultValuesFromExisting,
    mileage: existingChecklist.mileage,
    observations: existingChecklist.observations ?? '',
    signature: existingChecklist.signature,
  } : {
    ...defaultValuesFromExisting,
    mileage: vehicle.mileage ?? undefined,
    observations: '',
    signature: currentOperatorName,
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
    disabled: !!existingChecklist,
  });

  const addChecklistMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const itemsForDb: ChecklistItemType[] = checklistItemsDefinition.map(itemDef => ({
        id: itemDef.id,
        label: itemDef.label,
        value: values[itemDef.name as keyof typeof values] as boolean, // Zod schema garante que é boolean
      }));

      const newChecklistData: Omit<Checklist, 'id' | 'date'> & { date: Date } = {
        vehicleId: vehicle.id,
        operatorId: currentOperatorId,
        operatorName: currentOperatorName,
        date: new Date(),
        items: itemsForDb,
        mileage: values.mileage,
        observations: values.observations ?? '',
        signature: values.signature,
      };
      await addChecklistService(newChecklistData);
      await updateVehicleService(vehicle.id, { mileage: values.mileage });
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
    mutationFn: () => returnVehicle(vehicle.id, currentOperatorId, vehicle.mileage ?? 0), // Passa o KM atual do veículo
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
    if (vehicle.mileage !== undefined && values.mileage < vehicle.mileage) {
        form.setError("mileage", {
            type: "manual",
            message: `KM atual não pode ser menor que o último KM registrado (${vehicle.mileage.toLocaleString('pt-BR')}).`
        });
        return;
    }
    addChecklistMutation.mutate(values);
  }

  function handleExportPdf() {
    const itemsToExport: ChecklistItemType[] = existingChecklist
      ? existingChecklist.items
      : checklistItemsDefinition.map(itemDef => ({
          id: itemDef.id,
          label: itemDef.label,
          value: form.getValues(itemDef.name as keyof z.infer<typeof formSchema>) as boolean | null,
        }));

    const dataToExport = existingChecklist || {
        ...form.getValues(),
        items: itemsToExport,
        date: new Date().toISOString(),
        operatorName: currentOperatorName,
        signature: form.getValues("signature")
    };

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const leftMargin = 15;
    const rightMargin = 15;
    const topMargin = 15; // Ajustado para dar espaço ao logo
    const bottomMargin = 20;
    const contentWidth = pageWidth - leftMargin - rightMargin;
    let yPos = topMargin;
    const lineHeight = 5; 
    const cellPadding = 2;

    // Desenhar Logo
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('FrotaÁgil', pageWidth - rightMargin, topMargin, { align: 'right' });
    yPos += 10; // Espaço após o logo


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
    yPos += 12;

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
        // Redesenhar logo e cabeçalho da página
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
        doc.setTextColor(0, 100, 0); // Dark Green
        statusTextWithIcon = "✓ Sim";
      } else if (itemValue === false) {
        doc.setTextColor(200, 0, 0); // Dark Red
        statusTextWithIcon = "✗ Não";
      } else {
        doc.setTextColor(105, 105, 105); // Dark Grey
      }
      
      doc.text(statusTextWithIcon, statusColX + cellPadding, textY);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0); // Reset color to black

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
    const sigTextHeight = lineHeight; // Assuming signature is single line
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

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center text-2xl">
          <FilePenLineIcon className="mr-3 h-7 w-7 text-primary" />
          {isViewing ? 'Visualizar Checklist' : 'Checklist Diário do Veículo'}
        </CardTitle>
        <CardDescription>
          Veículo: {vehicle.make} {vehicle.model} (Placa: {vehicle.plate})
          {defaultValues.mileage !== undefined && !isViewing && <span className="block text-xs text-muted-foreground">Última KM registrada: {defaultValues.mileage.toLocaleString('pt-BR')}</span>}
          {isViewing && existingChecklist?.mileage && <span className="block text-xs text-muted-foreground">KM registrada no checklist: {existingChecklist.mileage.toLocaleString('pt-BR')}</span>}
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {checklistItemsDefinition.map(itemDef => (
              <FormField
                key={itemDef.id} 
                control={form.control}
                name={itemDef.name}
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
                            <RadioGroupItem value="true" id={`${itemDef.id}-yes`} />
                          </FormControl>
                          <FormLabel htmlFor={`${itemDef.id}-yes`} className="font-normal cursor-pointer">Sim</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <RadioGroupItem value="false" id={`${itemDef.id}-no`} />
                          </FormControl>
                          <FormLabel htmlFor={`${itemDef.id}-no`} className="font-normal cursor-pointer">Não</FormLabel>
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
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações Adicionais (danos, problemas, etc.)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Relate qualquer problema identificado ou detalhe importante sobre o estado do veículo..."
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
                        {returnVehicleMutation.isPending ? 'Devolvendo...' : <><Undo2Icon className="mr-2 h-4 w-4" /> Cancelar e Devolver Veículo</>}
                    </Button>
                    <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground sm:w-auto" disabled={addChecklistMutation.isPending}>
                        {addChecklistMutation.isPending ? 'Enviando...' : <><SendIcon className="mr-2 h-4 w-4" /> Enviar Checklist</>}
                    </Button>
                </>
            )}
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

