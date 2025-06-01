
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ReportIncidentForm } from './ReportIncidentForm';
import { MessageSquareWarningIcon } from 'lucide-react'; // Using a different icon

interface ReportIncidentDialogProps {
  vehicleId: string;
  vehiclePlate: string;
  operatorId: string;
  operatorName: string;
  disabled?: boolean;
}

export function ReportIncidentDialog({
  vehicleId,
  vehiclePlate,
  operatorId,
  operatorName,
  disabled = false,
}: ReportIncidentDialogProps) {
  const [open, setOpen] = useState(false);

  const handleFormSubmit = () => {
    setOpen(false); // Close dialog on successful form submission
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" disabled={disabled}>
          <MessageSquareWarningIcon className="mr-2 h-4 w-4" />
          Registrar Ocorrência
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Registrar Nova Ocorrência</DialogTitle>
          <DialogDescription>
            Relate qualquer sinistro, dano ou alteração percebida no veículo {vehiclePlate}.
            Sua comunicação é importante para a manutenção da frota.
          </DialogDescription>
        </DialogHeader>
        <ReportIncidentForm
          vehicleId={vehicleId}
          operatorId={operatorId}
          operatorName={operatorName}
          onFormSubmit={handleFormSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
