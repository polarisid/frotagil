
'use client';

import type { Checklist, Vehicle, ChecklistTableProps as CustomChecklistTableProps, ChecklistItem } from '@/lib/types';
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
import { format as formatDateFn } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function ChecklistTable({ checklists, vehicles, isAdminView = false }: CustomChecklistTableProps) {
  const { toast } = useToast();

  const handleExportPdf = (checklist: Checklist) => {
    const vehicle = vehicles.find(v => v.id === checklist.vehicleId);
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
    doc.text(`Veículo: ${vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.plate})` : 'Veículo Desconhecido'}`, leftMargin, yPos);
    yPos += 7;
    doc.text(`Operador: ${checklist.operatorName}`, leftMargin, yPos);
    yPos += 7;
    doc.text(`Data: ${formatDateFn(new Date(checklist.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, leftMargin, yPos);
    yPos += 7;
    if (checklist.mileage !== undefined) {
      doc.text(`KM Registrado: ${checklist.mileage.toLocaleString('pt-BR')} km`, leftMargin, yPos);
    }
    yPos += 7;
    if (checklist.routeDescription) {
      doc.text(`Descrição da Rota: ${checklist.routeDescription}`, leftMargin, yPos);
      yPos += 7;
    }
    yPos += 5;


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

    // Use checklist.items directly which contains { id, label, value }
    const itemsToDisplay: ChecklistItem[] = checklist.items;

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


    itemsToDisplay.forEach(item => {
      // item.label and item.value are directly from the checklist's stored items
      drawItemRowPdf(item.label, item.value); 
    });
    
    yPos += 5; 

    if (checklist.observations) {
      const obsTitleHeight = 7;
      const obsTextHeight = doc.splitTextToSize(checklist.observations, contentWidth).length * lineHeight;
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
      const splitObservations = doc.splitTextToSize(checklist.observations, contentWidth); 
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
    doc.text(checklist.signature, leftMargin, yPos);

    doc.save(`checklist-${checklist.id.substring(0,8)}-${vehicle?.plate || 'desconhecido'}.pdf`);

    toast({ title: 'Exportar Checklist PDF', description: `Checklist ${checklist.id.substring(0,8)} exportado para PDF.`});
  };

  const getVehicleInfo = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.plate})` : 'Veículo Desconhecido';
  };

  const hasIssues = (checklist: Checklist) => {
    return checklist.items.some(item => item.value === false);
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
                {formatDateFn(new Date(checklist.date), "dd/MM/yy HH:mm", { locale: ptBR })}
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

    