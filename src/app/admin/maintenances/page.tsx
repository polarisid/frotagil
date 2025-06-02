
'use client';

import { PageTitle } from '@/components/shared/PageTitle';
import { Container } from '@/components/shared/Container';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircleIcon, SearchIcon, FilterIcon, UploadCloudIcon, FileTextIcon, ListChecksIcon, AlertTriangleIcon, CheckCircleIcon, DownloadIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { MaintenanceTable } from '@/components/admin/MaintenanceTable';
import type { Maintenance, Vehicle as VehicleType } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMaintenances, addMaintenance } from '@/lib/services/maintenanceService';
import { getVehicles } from '@/lib/services/vehicleService';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useRef, ChangeEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as DialogDesc, DialogFooter, DialogClose } from '@/components/ui/dialog';
import readXlsxFile, { Row } from 'read-excel-file';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { format, parse, isValid, parseISO } from 'date-fns';

const ALL_ITEMS_VALUE = "all";

interface ParsedMaintenanceData {
  vehicleId?: string; // Found vehicle ID
  plate: string;
  description: string;
  type: 'preventive' | 'corrective';
  priority: 'low' | 'medium' | 'high';
  scheduledKm?: number;
  scheduledDate?: string; // YYYY-MM-DD
  completionDate?: string; // YYYY-MM-DD
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  originalRow: Row;
  error?: string;
}


export default function AdminMaintenancesPage() {
  const [searchDescription, setSearchDescription] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccessCount, setImportSuccessCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: maintenancesData, isLoading: maintenancesLoading, error: maintenancesError } = useQuery<Maintenance[], Error>({
    queryKey: ['maintenances', selectedVehicleId, selectedStatus],
    queryFn: () => getMaintenances({ vehicleId: selectedVehicleId, status: selectedStatus }),
  });

  const { data: vehiclesData, isLoading: vehiclesLoading, error: vehiclesError } = useQuery<VehicleType[], Error>({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
  });

  const addMaintenanceMutation = useMutation({
    mutationFn: (maintenance: Omit<Maintenance, 'id'>) => addMaintenance(maintenance),
    onSuccess: () => {
      // Individual success is handled in batch, main toast after all done
    },
    onError: (error: Error, variables) => {
      // Handled in batch processing
    },
  });


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setExcelFile(event.target.files[0]);
      setImportErrors([]);
      setImportSuccessCount(0);
    }
  };

  const parseDate = (dateInput: any): string | undefined => {
    if (!dateInput) return undefined;
    
    // read-excel-file often converts Excel dates to JS Date objects
    if (dateInput instanceof Date && isValid(dateInput)) {
      return format(dateInput, 'yyyy-MM-dd');
    }

    // Handle string dates (YYYY-MM-DD or DD/MM/YYYY)
    if (typeof dateInput === 'string') {
      let parsedDate = parseISO(dateInput); // Handles YYYY-MM-DD and YYYY-MM-DDTHH:mm:ss.sssZ
      if (isValid(parsedDate)) return format(parsedDate, 'yyyy-MM-dd');
      
      parsedDate = parse(dateInput, 'dd/MM/yyyy', new Date());
      if (isValid(parsedDate)) return format(parsedDate, 'yyyy-MM-dd');

      // Fallback for YYYY-MM-DD just in case parseISO didn't catch it (e.g. no time component)
      parsedDate = parse(dateInput, 'yyyy-MM-dd', new Date());
      if (isValid(parsedDate)) return format(parsedDate, 'yyyy-MM-dd');
    }
    
    // Handle Excel date numbers if read-excel-file didn't convert them
    if (typeof dateInput === 'number') {
      try {
        // Excel epoch is Dec 30, 1899 for Windows, or Dec 31, 1899.
        // However, `read-excel-file` usually handles this conversion.
        // This is a fallback for direct number parsing if needed.
        const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Use UTC to avoid timezone issues with epoch
        const parsedDate = new Date(excelEpoch.getTime() + dateInput * 24 * 60 * 60 * 1000);
        if(isValid(parsedDate)) return format(parsedDate, 'yyyy-MM-dd');
      } catch (e) { /* ignore error if number parsing fails */ }
    }
    
    console.warn("Could not parse date input:", dateInput);
    return undefined;
  };


  const handleProcessExcel = async () => {
    if (!excelFile || !vehiclesData) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Nenhum arquivo selecionado ou dados de veículos não carregados.' });
      return;
    }
    setIsImporting(true);
    setImportErrors([]);
    setImportSuccessCount(0);
    let localSuccessCount = 0;
    const localErrors: string[] = [];

    try {
      const rows = await readXlsxFile(excelFile);
      // Skip header row (rows[0])
      const dataRows = rows.slice(1);
      const maintenancesToCreate: Omit<Maintenance, 'id'>[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowIndex = i + 2; // Excel row number

        const plate = String(row[1]).toUpperCase();
        const vehicle = vehiclesData.find(v => v.plate === plate);
        if (!vehicle) {
          localErrors.push(`Linha ${rowIndex}: Veículo com placa ${plate} não encontrado.`);
          continue;
        }

        const statusRaw = String(row[5]);
        let status: Maintenance['status'];
        switch (statusRaw.toLowerCase()) {
          case 'planejada': status = 'planned'; break;
          case 'em progresso': status = 'in_progress'; break;
          case 'concluída': status = 'completed'; break;
          case 'cancelada': status = 'cancelled'; break;
          default:
            localErrors.push(`Linha ${rowIndex}: Status '${statusRaw}' inválido. Use: Planejada, Em Progresso, Concluída, Cancelada.`);
            continue;
        }
        
        const km = row[2] ? Number(row[2]) : undefined;
        if (row[2] && (isNaN(km as number) || (km as number) < 0)) {
            localErrors.push(`Linha ${rowIndex}: Quilometragem '${row[2]}' inválida.`);
            continue;
        }

        const dateRaw = row[4]; // "Data Realizada" column
        let scheduledDateExcel: string | undefined = undefined;
        let completionDateExcel: string | undefined = undefined;

        if (status === 'planned' || status === 'in_progress') {
          scheduledDateExcel = parseDate(dateRaw);
          if (dateRaw && !scheduledDateExcel) { // If a date was provided but couldn't be parsed
            localErrors.push(`Linha ${rowIndex}: Data de agendamento '${dateRaw}' inválida para status '${statusRaw}'. Use AAAA-MM-DD ou DD/MM/AAAA.`);
            continue;
          }
          // completionDateExcel remains undefined
        } else if (status === 'completed') {
          completionDateExcel = parseDate(dateRaw);
          if (!completionDateExcel) { // Date is mandatory and must be valid for 'completed'
            localErrors.push(`Linha ${rowIndex}: Data de conclusão '${dateRaw}' é obrigatória e deve ser válida para status 'Concluída'. Use AAAA-MM-DD ou DD/MM/AAAA.`);
            continue;
          }
          // scheduledDateExcel can be undefined or you might parse it from another column if available
        } else if (status === 'cancelled') {
          // For 'cancelled', the date might be the original scheduled date or when it was cancelled.
          // We'll assume it's the scheduledDate if provided.
          scheduledDateExcel = parseDate(dateRaw);
           if (dateRaw && !scheduledDateExcel) {
             localErrors.push(`Linha ${rowIndex}: Data '${dateRaw}' inválida para status '${statusRaw}'. Use AAAA-MM-DD ou DD/MM/AAAA.`);
             continue;
           }
           // completionDateExcel remains undefined
        }


        const maintenanceEntry: Omit<Maintenance, 'id'> = {
          vehicleId: vehicle.id,
          description: String(row[3]),
          type: 'preventive', // Default for plan
          priority: 'medium', // Default for plan
          status: status,
          scheduledKm: km, // can be undefined
          scheduledDate: scheduledDateExcel, // can be undefined
          completionDate: completionDateExcel, // can be undefined
          cost: undefined, // Not in Excel template
          observations: `Importado via Excel. Modelo do veículo na planilha: ${String(row[0])}`,
        };
        maintenancesToCreate.push(maintenanceEntry);
      }

      for (const entry of maintenancesToCreate) {
        try {
          await addMaintenanceMutation.mutateAsync(entry);
          localSuccessCount++;
        } catch (error: any) {
          localErrors.push(`Erro ao adicionar manutenção para ${entry.vehicleId} (${entry.description.substring(0,20)}...): ${error.message}`);
        }
      }
      
      setImportSuccessCount(localSuccessCount);
      setImportErrors(localErrors);

      if (localSuccessCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['maintenances'] });
        toast({ title: 'Importação Concluída', description: `${localSuccessCount} manutenções importadas com sucesso.` });
      }
      if (localErrors.length > 0) {
        toast({ variant: 'destructive', title: 'Erros na Importação', description: `Algumas linhas não puderam ser importadas. Veja detalhes no diálogo.` });
      }
      if (localSuccessCount === 0 && localErrors.length === 0 && dataRows.length > 0){
        toast({ title: 'Nenhuma Manutenção Importada', description: 'Verifique o arquivo ou os dados da planilha.' });
      }
      if(dataRows.length === 0){
         toast({ title: 'Planilha Vazia', description: 'A planilha não contém dados para importar (após o cabeçalho).' });
      }

    } catch (error: any) {
      console.error('Erro ao processar arquivo Excel:', error);
      setImportErrors([`Erro ao ler o arquivo: ${error.message}`]);
      toast({ variant: 'destructive', title: 'Erro na Leitura do Arquivo', description: 'Não foi possível processar a planilha. Verifique o formato.' });
    } finally {
      setIsImporting(false);
      setExcelFile(null);
      if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      ["Modelo", "Placa", "Kilometragem", "Itens da Manutenção", "Data Realizada", "Status"],
      ["Caminhão X", "ABC1D23", 150000, "Troca de óleo e filtros", "01/12/2024", "Planejada"],
      ["Van Y", "DEF4E56", 85000, "Verificação de freios", "", "Em Progresso"], // Data pode ser vazia para "Em Progresso"
      ["Pickup Z", "GHI7F89", 25000, "Revisão completa", "15/10/2024", "Concluída"], // Data é obrigatória para "Concluída"
      ["Outro Modelo", "JKL0A12", 10000, "Inspeção geral", "20/01/2025", "Planejada"],
      ["Caminhão A", "MNO3B45", 120000, "Ajuste de motor", "", "Cancelada"], // Data pode ser vazia para "Cancelada"
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    // Ajustar largura das colunas (opcional, mas melhora a visualização)
    worksheet['!cols'] = [
        { wch: 15 }, // Modelo
        { wch: 10 }, // Placa
        { wch: 12 }, // Kilometragem
        { wch: 30 }, // Itens da Manutenção
        { wch: 15 }, // Data Realizada
        { wch: 15 }  // Status
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "PlanoManutencao");
    XLSX.writeFile(workbook, "Modelo_Plano_Manutencao_FrotaAgil.xlsx");
    toast({ title: 'Download Iniciado', description: 'O modelo da planilha de manutenção foi baixado.' });
  };


  const filteredMaintenances = maintenancesData?.filter(maint => 
    maint.description.toLowerCase().includes(searchDescription.toLowerCase())
  ) || [];

  const isLoading = maintenancesLoading || vehiclesLoading;
  const queryError = maintenancesError || vehiclesError;

  if (isLoading) {
    return (
      <Container>
        <PageTitle title="Gerenciamento de Manutenções" description="Carregando manutenções..." />
        <Card className="mb-6 shadow-md">
          <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
             {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </CardContent>
        </Card>
        <Skeleton className="h-64 w-full" />
      </Container>
    );
  }

  if (queryError) {
    return <Container><PageTitle title="Erro" description={`Não foi possível carregar os dados: ${queryError.message}`} /></Container>;
  }


  return (
    <Container>
      <PageTitle
        title="Gerenciamento de Manutenções"
        description="Visualize, adicione ou edite as manutenções dos veículos da frota."
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => setIsImportDialogOpen(true)} variant="outline">
              <UploadCloudIcon className="mr-2 h-4 w-4" />
              Importar Plano (Excel)
            </Button>
            <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link href="/admin/maintenances/new"> 
                <PlusCircleIcon className="mr-2 h-4 w-4" />
                Agendar Manutenção
              </Link>
            </Button>
          </div>
        }
      />
      
      <Card className="mb-6 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center text-xl">
            <FilterIcon className="mr-2 h-5 w-5 text-primary" />
            Filtros de Manutenção
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input 
            placeholder="Buscar por descrição..." 
            value={searchDescription}
            onChange={(e) => setSearchDescription(e.target.value)}
          />
           <div>
            <label htmlFor="vehicle-filter-maint" className="mb-1 block text-sm font-medium text-muted-foreground">Veículo</label>
            <Select
              onValueChange={(value) => setSelectedVehicleId(value === ALL_ITEMS_VALUE ? undefined : value)}
              value={selectedVehicleId}
            >
              <SelectTrigger id="vehicle-filter-maint">
                <SelectValue placeholder="Todos os veículos" />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value={ALL_ITEMS_VALUE}>Todos os veículos</SelectItem>
                {vehiclesData?.map(v => <SelectItem key={v.id} value={v.id}>{v.plate} - {v.make} {v.model}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
           <div>
            <label htmlFor="status-filter-maint" className="mb-1 block text-sm font-medium text-muted-foreground">Status</label>
            <Select
              onValueChange={(value) => setSelectedStatus(value === ALL_ITEMS_VALUE ? undefined : value)}
              value={selectedStatus}
            >
              <SelectTrigger id="status-filter-maint">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value={ALL_ITEMS_VALUE}>Todos os status</SelectItem>
                <SelectItem value="planned">Planejada</SelectItem>
                <SelectItem value="in_progress">Em Progresso</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
          </div>
        </CardContent>
      </Card>

      <MaintenanceTable maintenances={filteredMaintenances} vehicles={vehiclesData || []} />

      <Dialog open={isImportDialogOpen} onOpenChange={(isOpen) => {
          setIsImportDialogOpen(isOpen);
          if (!isOpen) { // Reset state when dialog is closed
            setExcelFile(null);
            if(fileInputRef.current) fileInputRef.current.value = '';
            setImportErrors([]);
            setImportSuccessCount(0);
          }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar Plano de Manutenção via Excel</DialogTitle>
            <DialogDesc>
              Selecione um arquivo .xlsx ou .xls. A primeira linha deve ser o cabeçalho e será ignorada.
              Colunas esperadas: Modelo, Placa, Kilometragem, Itens da Manutenção, Data Realizada, Status.
            </DialogDesc>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col space-y-2">
                <Input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                ref={fileInputRef}
                disabled={isImporting}
                />
                {excelFile && <p className="text-sm text-muted-foreground">Arquivo selecionado: {excelFile.name}</p>}
            </div>
            
            <Button variant="link" onClick={handleDownloadTemplate} className="text-sm p-0 h-auto justify-start">
              <DownloadIcon className="mr-2 h-4 w-4" />
              Baixar Planilha Modelo
            </Button>

            {(importSuccessCount > 0 || importErrors.length > 0) && !isImporting && (
              <Card className="mt-4 max-h-60 overflow-y-auto">
                <CardHeader className="p-4">
                  <CardTitle className="text-base">Resultado da Importação</CardTitle>
                </CardHeader>
                <CardContent className="p-4 text-sm space-y-2">
                  {importSuccessCount > 0 && (
                    <div className="flex items-center text-green-600">
                      <CheckCircleIcon className="mr-2 h-4 w-4" />
                      {importSuccessCount} manutenções importadas com sucesso.
                    </div>
                  )}
                  {importErrors.length > 0 && (
                    <div>
                      <div className="flex items-center text-destructive mb-1">
                        <AlertTriangleIcon className="mr-2 h-4 w-4" />
                        {importErrors.length} erros encontrados:
                      </div>
                      <ul className="list-disc pl-5 space-y-1 text-destructive">
                        {importErrors.slice(0, 10).map((err, i) => <li key={i}>{err}</li>)}
                        {importErrors.length > 10 && <li>E mais {importErrors.length - 10} erros...</li>}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" onClick={() => { /* Reset handled by onOpenChange */ }} disabled={isImporting}>Cancelar</Button></DialogClose>
            <Button onClick={handleProcessExcel} disabled={!excelFile || isImporting}>
              {isImporting ? 'Processando...' : <><FileTextIcon className="mr-2 h-4 w-4" /> Processar Planilha</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Container>
  );
}
