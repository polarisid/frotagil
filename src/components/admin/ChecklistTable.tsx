
'use client';

import type { Checklist, Vehicle, ChecklistTableProps as CustomChecklistTableProps } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EyeIcon, PrinterIcon, MoreHorizontalIcon, GaugeIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Mantendo a definição completa aqui para consistência na exportação do PDF pelo admin
const fullChecklistItemsDefinition: { id: string; label: string }[] = [
  { id: "tires", label: "Pneus calibrados e em bom estado?" },
  { id: "lights", label: "Luzes (faróis, lanternas, setas, freio) funcionando?" },
  { id: "brakes", label: "Freios (pedal e de mão) com resposta normal?" },
  { id: "oilLevel", label: "Nível de óleo do motor verificado e normal?" },
  { id: "waterLevel", label: "Nível da água do radiador verificado e normal?" },
  { id: "brakeFluid", label: "Nível do fluido de freio verificado e normal?" },
  { id: "fireExtinguisher", label: "Extintor de incêndio válido e pressurizado?" },
  { id: "warningTriangle", label: "Triângulo de sinalização presente e em bom estado?" },
  { id: "jackAndWrench", label: "Macaco e chave de roda presentes e funcionais?" },
  { id: "vehicleDocuments", label: "Documentação do veículo (CRLV) presente e válida?" },
  { id: "interiorCleanliness", label: "Limpeza interna do veículo satisfatória?" },
  { id: "exteriorCleanliness", label: "Limpeza externa do veículo satisfatória?" },
];

export function ChecklistTable({ checklists, vehicles, isAdminView = false }: CustomChecklistTableProps) {
  const { toast } = useToast();

  const handleExportPdf = (checklist: Checklist) => {
    const vehicle = vehicles.find(v => v.id === checklist.vehicleId);
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Relatório de Checklist de Veículo', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Data: ${format(new Date(checklist.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 35);
    doc.text(`Operador: ${checklist.operatorName}`, 14, 42);
    doc.text(`Veículo: ${vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.plate})` : 'Veículo Desconhecido'}`, 14, 49);
    if (checklist.mileage !== undefined) {
      doc.text(`KM Registrado: ${checklist.mileage.toLocaleString('pt-BR')} km`, 14, 56);
    }

    doc.setFontSize(14);
    doc.text('Itens Verificados:', 14, 70);
    let yPos = 78;

    const itemsToDisplay = fullChecklistItemsDefinition.map(defItem => {
        const submittedItem = checklist.items.find(ci => ci.id === defItem.id);
        return {
            label: defItem.label,
            value: submittedItem ? submittedItem.value : null // Default to N/A if not found
        };
    });

    itemsToDisplay.forEach(item => {
      doc.setFontSize(10);
      const statusText = item.value === true ? 'Sim' : item.value === false ? 'Não' : 'N/A';
      doc.text(`${item.label}: ${statusText}`, 20, yPos);
      yPos += 7;
      if (yPos > 280) { // Basic page break handling
        doc.addPage();
        yPos = 20;
      }
    });

    if (checklist.observations) {
      doc.setFontSize(12);
      doc.text('Observações:', 14, yPos + 5);
      doc.setFontSize(10);
      const splitObservations = doc.splitTextToSize(checklist.observations, 170); // Max width 170mm
      doc.text(splitObservations, 20, yPos + 12);
      yPos += (splitObservations.length * 5) + 12;
       if (yPos > 280) { doc.addPage(); yPos = 20; }
    }
    
    doc.setFontSize(12);
    doc.text('Assinatura (Digital):', 14, yPos + 10);
    doc.setFontSize(10);
    doc.setFont("courier", "normal"); // Monospaced font for signature
    doc.text(checklist.signature, 20, yPos + 17);
    
    doc.save(`checklist-${checklist.id.substring(0,8)}-${vehicle?.plate || 'desconhecido'}.pdf`);

    toast({ title: 'Exportar Checklist PDF', description: `Checklist ${checklist.id.substring(0,8)} exportado para PDF.`});
  };

  const getVehicleInfo = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.plate})` : 'Veículo Desconhecido';
  };

  const hasIssues = (checklist: Checklist) => {
    return checklist.items.some(item => item.value === false); // Nok (Não) é um problema
  };

  const getViewLink = (checklist: Checklist) => {
    if (isAdminView) {
      return `/admin/checklists/view/${checklist.id}`;
    }
    return `/operator/checklist/${checklist.vehicleId}?checklistId=${checklist.id}`;
  };

  return (
    <div className="overflow-hidden rounded-lg border shadow-md">
      <Table>
        <TableHeader className="bg-secondary">
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Operador</TableHead>
            <TableHead>Veículo</TableHead>
            <TableHead className="hidden sm:table-cell">KM</TableHead>
            <TableHead className="hidden md:table-cell">Observações</TableHead>
            <TableHead className="hidden md:table-cell">Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {checklists.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                Nenhum checklist encontrado.
              </TableCell>
            </TableRow>
          )}
          {checklists.map((checklist) => (
            <TableRow key={checklist.id} className="hover:bg-muted/50">
              <TableCell>
                {format(new Date(checklist.date), "dd/MM/yy HH:mm", { locale: ptBR })}
              </TableCell>
              <TableCell>{checklist.operatorName}</TableCell>
              <TableCell>{getVehicleInfo(checklist.vehicleId)}</TableCell>
              <TableCell className="hidden sm:table-cell">
                {checklist.mileage ? `${checklist.mileage.toLocaleString('pt-BR')} km` : '-'}
              </TableCell>
              <TableCell className="hidden md:table-cell truncate max-w-xs">{checklist.observations || '-'}</TableCell>
              <TableCell className="hidden md:table-cell">
                {hasIssues(checklist) ? (
                  <Badge variant="destructive">Com Problemas</Badge>
                ) : (
                  <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">OK</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                 <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontalIcon className="h-4 w-4" />
                       <span className="sr-only">Ações</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Opções</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href={getViewLink(checklist)}>
                        <EyeIcon className="mr-2 h-4 w-4" /> Visualizar
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportPdf(checklist)}>
                      <PrinterIcon className="mr-2 h-4 w-4" /> Exportar PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
