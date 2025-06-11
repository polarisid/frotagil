
'use client';

import type { Fine } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EyeIcon, CheckCircle2Icon, AlertCircleIcon, ShieldQuestionIcon, XCircleIcon, ReceiptTextIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OperatorFineTableProps {
  fines: Fine[];
}

export function OperatorFineTable({ fines }: OperatorFineTableProps) {
  const { toast } = useToast();

  const statusConfig: Record<Fine['status'], { label: string; icon: React.ElementType; className: string }> = {
    pending: { label: 'Pendente', icon: AlertCircleIcon, className: 'bg-yellow-100 text-yellow-700 border-yellow-500' },
    paid: { label: 'Paga', icon: CheckCircle2Icon, className: 'bg-green-100 text-green-700 border-green-500' },
    appealed: { label: 'Recorrida', icon: ShieldQuestionIcon, className: 'bg-blue-100 text-blue-700 border-blue-500' },
    cancelled: { label: 'Cancelada', icon: XCircleIcon, className: 'bg-red-100 text-red-700 border-red-500' },
  };

  const handleViewDetails = (fine: Fine) => {
    toast({
      title: `Detalhes da Multa #${fine.id.substring(0, 8)}`,
      description: (
        <div className="text-sm space-y-1">
          <p><strong>Veículo:</strong> {fine.vehiclePlate}</p>
          <p><strong>Cód. Infração:</strong> {fine.infractionCode}</p>
          <p><strong>Descrição:</strong> {fine.description}</p>
          <p><strong>Local:</strong> {fine.location}</p>
          <p><strong>Data da Infração:</strong> {format(parseISO(fine.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
          {/* fine.createdAt (Data de Registro) is not shown in toast to match table columns */}
          <p><strong>Vencimento:</strong> {format(parseISO(fine.dueDate), "dd/MM/yyyy", { locale: ptBR })}</p>
          <p><strong>Valor:</strong> R$ {fine.amount.toFixed(2)}</p>
          <p><strong>Status:</strong> {statusConfig[fine.status]?.label || fine.status}</p>
          {fine.adminNotes && <p><strong>Notas Admin:</strong> {fine.adminNotes}</p>}
        </div>
      ),
      duration: 15000,
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border shadow-md">
      <Table>
        <TableHeader className="bg-secondary">
          <TableRow>
            <TableHead>Data Infração</TableHead> {/* This column is always visible */}
            <TableHead>Veículo</TableHead>
            <TableHead className="hidden md:table-cell">Cód. Infração</TableHead>
            <TableHead className="hidden lg:table-cell">Valor (R$)</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fines.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                Nenhuma multa encontrada.
              </TableCell>
            </TableRow>
          )}
          {fines.map((fine) => {
            const currentStatus = statusConfig[fine.status] || { label: fine.status, icon: ReceiptTextIcon, className: 'bg-gray-200 text-gray-800 border-gray-500' };
            const StatusIcon = currentStatus.icon;
            return (
              <TableRow key={fine.id} className="hover:bg-muted/50">
                <TableCell>{format(parseISO(fine.date), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell> {/* This cell is always visible */}
                <TableCell>{fine.vehiclePlate}</TableCell>
                <TableCell className="hidden md:table-cell">{fine.infractionCode}</TableCell>
                <TableCell className="hidden lg:table-cell">{fine.amount.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("text-xs", currentStatus.className)}>
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {currentStatus.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleViewDetails(fine)}>
                    <EyeIcon className="h-4 w-4" />
                    <span className="sr-only">Ver Detalhes</span>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
