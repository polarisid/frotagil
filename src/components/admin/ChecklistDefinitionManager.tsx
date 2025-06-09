
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { PlusCircleIcon, EditIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, CheckCircle2Icon, SaveIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangleIcon } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChecklistItemDefinition } from '@/lib/types';
import { 
  getChecklistItemDefinitions, 
  addChecklistItemDefinition, 
  updateChecklistItemDefinition, 
  deleteChecklistItemDefinition,
  reorderChecklistItemDefinitions
} from '@/lib/services/checklistDefinitionService';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';

const itemDefinitionSchema = z.object({
  itemId: z.string().min(3, 'ID do item deve ter pelo menos 3 caracteres. Use camelCase (ex: "tirePressure").').regex(/^[a-zA-Z0-9_]+$/, 'ID do item pode conter apenas letras, números e underscores.'),
  label: z.string().min(5, 'O texto do item deve ter pelo menos 5 caracteres.'),
  isActive: z.boolean().default(true),
  order: z.number().optional(), // Ordem será gerenciada separadamente ou ao adicionar
});

type ItemDefinitionFormValues = z.infer<typeof itemDefinitionSchema>;

export function ChecklistDefinitionManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItemDefinition | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ChecklistItemDefinition | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

  const { data: definitions, isLoading, error } = useQuery<ChecklistItemDefinition[], Error>({
    queryKey: ['checklistItemDefinitions', false], // Key for fetching all items
    queryFn: () => getChecklistItemDefinitions(false), // Fetch all items, including inactive
  });

  const form = useForm<ItemDefinitionFormValues>({
    resolver: zodResolver(itemDefinitionSchema),
    defaultValues: { itemId: '', label: '', isActive: true },
  });

  useEffect(() => {
    if (editingItem) {
      form.reset({
        itemId: editingItem.itemId,
        label: editingItem.label,
        isActive: editingItem.isActive,
      });
    } else {
      form.reset({ itemId: '', label: '', isActive: true });
    }
  }, [editingItem, form, isFormOpen]);


  const addMutation = useMutation({
    mutationFn: addChecklistItemDefinition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklistItemDefinitions'] });
      toast({ title: 'Item Adicionado', description: 'Novo item de checklist adicionado com sucesso.' });
      setIsFormOpen(false);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao Adicionar', description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ docId, values }: { docId: string, values: Partial<Omit<ChecklistItemDefinition, 'docId' | 'itemId'>> }) => 
      updateChecklistItemDefinition(docId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklistItemDefinitions'] });
      toast({ title: 'Item Atualizado', description: 'Item de checklist atualizado com sucesso.' });
      setIsFormOpen(false);
      setEditingItem(null);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao Atualizar', description: error.message });
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: deleteChecklistItemDefinition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklistItemDefinitions'] }); // This should cover all queries starting with this key
      toast({ title: 'Item Excluído', description: 'Item de checklist excluído permanentemente.' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao Excluir', description: error.message });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: reorderChecklistItemDefinitions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklistItemDefinitions'] });
      toast({ title: 'Ordem Atualizada', description: 'Ordem dos itens atualizada.' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao Reordenar', description: error.message });
    },
  });


  const handleFormSubmit = (values: ItemDefinitionFormValues) => {
    if (editingItem) {
      // Cannot change itemId after creation due to potential data integrity issues
      const { itemId, ...updateData } = values;
      updateMutation.mutate({ docId: editingItem.docId, values: updateData });
    } else {
      const newOrder = definitions ? definitions.length + 1 : 1;
      addMutation.mutate({ ...values, order: newOrder });
    }
  };
  
  const handleEdit = (item: ChecklistItemDefinition) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleToggleActive = (item: ChecklistItemDefinition) => {
    updateMutation.mutate({ docId: item.docId, values: { isActive: !item.isActive } });
  };

  const handleDeleteRequest = (item: ChecklistItemDefinition) => {
    setItemToDelete(item);
    setIsDeleteAlertOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteMutation.mutate(itemToDelete.docId);
    }
    setIsDeleteAlertOpen(false);
    setItemToDelete(null);
  };
  
  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (!definitions) return;
    const newDefinitions = [...definitions];
    const itemToMove = newDefinitions[index];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;

    if (swapIndex < 0 || swapIndex >= newDefinitions.length) return;

    newDefinitions[index] = newDefinitions[swapIndex];
    newDefinitions[swapIndex] = itemToMove;
    
    const reordered = newDefinitions.map((item, idx) => ({ docId: item.docId, order: idx + 1 }));
    reorderMutation.mutate(reordered);
  };


  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangleIcon className="h-4 w-4" />
        <AlertTitle>Erro ao Carregar Itens do Checklist</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  const sortedDefinitions = definitions ? [...definitions].sort((a, b) => a.order - b.order) : [];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Gerenciar Itens Padrão do Checklist</CardTitle>
              <CardDescription>Adicione, edite, reordene ou desative os itens que aparecerão nos checklists.</CardDescription>
            </div>
            <Dialog open={isFormOpen} onOpenChange={(isOpen) => { setIsFormOpen(isOpen); if (!isOpen) setEditingItem(null); }}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingItem(null); form.reset(); setIsFormOpen(true); }}>
                  <PlusCircleIcon className="mr-2 h-4 w-4" /> Adicionar Novo Item
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingItem ? 'Editar Item do Checklist' : 'Adicionar Novo Item ao Checklist'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="itemId">ID do Item (único, sem espaços, ex: 'tirePressure')</Label>
                    <Input id="itemId" {...form.register('itemId')} disabled={!!editingItem} />
                    {form.formState.errors.itemId && <p className="text-sm text-destructive mt-1">{form.formState.errors.itemId.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="label">Texto do Item (Pergunta/Verificação)</Label>
                    <Input id="label" {...form.register('label')} />
                    {form.formState.errors.label && <p className="text-sm text-destructive mt-1">{form.formState.errors.label.message}</p>}
                  </div>
                   <div className="flex items-center space-x-2">
                     <Controller
                        name="isActive"
                        control={form.control}
                        render={({ field }) => <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />}
                      />
                    <Label htmlFor="isActive">Item Ativo (aparecerá nos checklists)</Label>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                    <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending}>
                        <SaveIcon className="mr-2 h-4 w-4" /> {editingItem ? 'Salvar Alterações' : 'Adicionar Item'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {sortedDefinitions.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center">Nenhum item de checklist definido. Clique em "Adicionar Novo Item" para começar.</p>
          ) : (
            <ul className="space-y-3">
              {sortedDefinitions.map((item, index) => (
                <li key={item.docId} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-md shadow-sm hover:bg-muted/50">
                  <div className="flex items-center mb-2 sm:mb-0">
                    <span className="mr-3 text-sm font-medium text-muted-foreground w-6 text-center">{item.order}.</span>
                    <div className="flex-1">
                      <p className={`font-medium ${!item.isActive ? 'line-through text-muted-foreground' : ''}`}>{item.label}</p>
                      <p className="text-xs text-muted-foreground">ID: {item.itemId} {item.isActive ? '' : '(Inativo)'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap">
                    <Button variant="ghost" size="icon" title="Mover para Cima" onClick={() => moveItem(index, 'up')} disabled={index === 0 || reorderMutation.isPending}>
                      <ArrowUpIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Mover para Baixo" onClick={() => moveItem(index, 'down')} disabled={index === sortedDefinitions.length - 1 || reorderMutation.isPending}>
                      <ArrowDownIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(item)}>
                      <EditIcon className="mr-1 sm:mr-2 h-3 w-3" /> Editar
                    </Button>
                    <Button variant={item.isActive ? "outline" : "default"} size="sm" 
                            className={item.isActive ? "text-yellow-600 border-yellow-500 hover:bg-yellow-50 hover:text-yellow-700" : "bg-green-500 hover:bg-green-600 text-white"}
                            onClick={() => handleToggleActive(item)}
                            disabled={updateMutation.isPending && updateMutation.variables?.docId === item.docId}
                    >
                      {item.isActive ? <TrashIcon className="mr-1 sm:mr-2 h-3 w-3" /> : <CheckCircle2Icon className="mr-1 sm:mr-2 h-3 w-3" />}
                      {item.isActive ? 'Desativar' : 'Reativar'}
                    </Button>
                     <Button variant="destructive" size="sm" onClick={() => handleDeleteRequest(item)}>
                        <TrashIcon className="mr-1 sm:mr-2 h-3 w-3" /> Excluir
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão Permanente</DialogTitle>
            <AlertDescription>
              Tem certeza que deseja excluir permanentemente o item "{itemToDelete?.label}" (ID: {itemToDelete?.itemId})? 
              Esta ação não pode ser desfeita. Se este item foi usado em checklists anteriores, ele não aparecerá mais nesses registros.
              Considere desativar o item se desejar mantê-lo em checklists históricos.
            </AlertDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteAlertOpen(false)} disabled={deleteMutation.isPending}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Excluindo..." : "Excluir Permanentemente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

    