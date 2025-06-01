
'use client'; 

import { PageTitle } from '@/components/shared/PageTitle';
import { Container } from '@/components/shared/Container';
import { ChecklistTable } from '@/components/admin/ChecklistTable';
import type { Checklist, Vehicle as VehicleType, User } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, FilterIcon, SearchIcon, ListChecksIcon, Settings2Icon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { useQuery } from '@tanstack/react-query';
import { getChecklists } from '@/lib/services/checklistService';
import { getVehicles } from '@/lib/services/vehicleService';
import { getUsers } from '@/lib/services/userService';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChecklistDefinitionManager } from '@/components/admin/ChecklistDefinitionManager';
import { initializeDefaultChecklistItems } from '@/lib/services/checklistDefinitionService'; // Import the initialization function
import { useEffect } from 'react';


const ALL_ITEMS_VALUE = "all"; 

export default function AdminChecklistsPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(undefined);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | undefined>(undefined);

  // Initialize default checklist items on component mount if needed
  useEffect(() => {
    async function initDefaults() {
      try {
        await initializeDefaultChecklistItems();
        // Optionally refetch definitions if your manager component doesn't handle this
        // queryClient.invalidateQueries(['checklistItemDefinitions']);
      } catch (error) {
        console.error("Error initializing default checklist items:", error);
      }
    }
    initDefaults();
  }, []);

  const { data: checklistsData, isLoading: checklistsLoading, error: checklistsError } = useQuery<Checklist[], Error>({
    queryKey: ['checklists', selectedDate, selectedVehicleId, selectedOperatorId],
    queryFn: () => getChecklists({
      date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined,
      vehicleId: selectedVehicleId,
      operatorId: selectedOperatorId,
    }),
  });

  const { data: vehiclesData, isLoading: vehiclesLoading, error: vehiclesError } = useQuery<VehicleType[], Error>({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
  });

  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery<User[], Error>({
    queryKey: ['users'],
    queryFn: () => getUsers(), 
  });

  const operators = usersData?.filter(u => u.role === 'operator') || [];

  const isLoadingOverall = checklistsLoading || vehiclesLoading || usersLoading;
  const queryError = checklistsError || vehiclesError || usersError;

  const renderSubmittedChecklistsTab = () => {
    if (isLoadingOverall) {
      return (
        <>
          <Card className="mb-6 shadow-md">
            <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </CardContent>
          </Card>
          <Skeleton className="h-64 w-full" />
        </>
      );
    }

    if (queryError) {
      return <Container><PageTitle title="Erro" description={`Não foi possível carregar os dados: ${queryError.message}`} /></Container>;
    }
    
    return (
      <>
        <Card className="mb-6 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <FilterIcon className="mr-2 h-5 w-5 text-primary" />
              Filtros de Busca de Checklists
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="date-filter" className="mb-1 block text-sm font-medium text-muted-foreground">Data</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button id="date-filter" variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    <span>{selectedDate ? format(selectedDate, 'PPP', { locale: require('date-fns/locale/pt-BR').ptBR }) : 'Selecione uma data'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label htmlFor="vehicle-filter" className="mb-1 block text-sm font-medium text-muted-foreground">Veículo</label>
              <Select
                onValueChange={(value) => setSelectedVehicleId(value === ALL_ITEMS_VALUE ? undefined : value)}
                value={selectedVehicleId || ALL_ITEMS_VALUE}
              >
                <SelectTrigger id="vehicle-filter">
                  <SelectValue placeholder="Todos os veículos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ITEMS_VALUE}>Todos os veículos</SelectItem>
                  {vehiclesData?.map(v => <SelectItem key={v.id} value={v.id}>{v.plate} - {v.make} {v.model}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
               <label htmlFor="operator-filter" className="mb-1 block text-sm font-medium text-muted-foreground">Operador</label>
              <Select
                onValueChange={(value) => setSelectedOperatorId(value === ALL_ITEMS_VALUE ? undefined : value)}
                value={selectedOperatorId || ALL_ITEMS_VALUE}
              >
                <SelectTrigger id="operator-filter">
                  <SelectValue placeholder="Todos os operadores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ITEMS_VALUE}>Todos os operadores</SelectItem>
                   {operators.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              {/* Filters apply on change, button can be for explicit action or removed */}
              {/* <Button className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
                  <SearchIcon className="mr-2 h-4 w-4"/> Aplicar Filtros
              </Button> */}
            </div>
          </CardContent>
        </Card>
        <ChecklistTable checklists={checklistsData || []} vehicles={vehiclesData || []} isAdminView={true} />
      </>
    );
  };

  return (
    <Container>
      <PageTitle
        title="Gerenciamento de Checklists"
        description="Visualize checklists submetidos ou gerencie os itens padrão dos checklists."
      />
      <Tabs defaultValue="submitted" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px] mb-6">
          <TabsTrigger value="submitted" className="text-sm">
            <ListChecksIcon className="mr-2 h-4 w-4" /> Checklists Submetidos
          </TabsTrigger>
          <TabsTrigger value="manageItems" className="text-sm">
            <Settings2Icon className="mr-2 h-4 w-4" /> Gerenciar Itens
          </TabsTrigger>
        </TabsList>
        <TabsContent value="submitted">
          {renderSubmittedChecklistsTab()}
        </TabsContent>
        <TabsContent value="manageItems">
          <ChecklistDefinitionManager />
        </TabsContent>
      </Tabs>
    </Container>
  );
}
