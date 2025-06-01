
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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { UserCogIcon, SaveIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateUser, getUserByEmail } from '@/lib/services/userService';

const editUserFormSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres.").max(100, "Nome muito longo."),
  email: z.string().email("Email inválido."), // Email will be displayed but not editable
  role: z.enum(['operator', 'admin'], { required_error: "Perfil é obrigatório." }),
  status: z.enum(['active', 'inactive'], { required_error: "Status é obrigatório." }),
});

type EditUserFormValues = z.infer<typeof editUserFormSchema>;

interface EditUserFormProps {
  user: User;
  onFormSubmitSuccess: () => void;
}

export function EditUserForm({ user, onFormSubmitSuccess }: EditUserFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {
      name: user.name,
      email: user.email, // Not editable, but needed for schema and display
      role: user.role,
      status: user.status || 'active',
    },
  });

  const updateUserMutation = useMutation<void, Error, { id: string; data: Partial<Omit<User, 'id' | 'email'>> }>({
    mutationFn: ({ id, data }) => updateUser(id, data),
    onSuccess: () => {
      toast({
        title: 'Usuário Atualizado!',
        description: `Os dados do usuário ${form.getValues('name')} foram atualizados.`,
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user', user.id] });
      onFormSubmitSuccess();
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao Atualizar',
        description: error.message || 'Não foi possível atualizar o usuário.',
      });
    },
  });

  async function onSubmit(values: EditUserFormValues) {
    // Email is not directly editable in this form version.
    // If email were editable, you'd check:
    // const existingUserWithNewEmail = await getUserByEmail(values.email);
    // if (existingUserWithNewEmail && existingUserWithNewEmail.id !== user.id) { /* ... error handling ... */ }

    const dataToUpdate: Partial<Omit<User, 'id' | 'email'>> = {
      name: values.name,
      role: values.role,
      status: values.status,
    };
    updateUserMutation.mutate({ id: user.id, data: dataToUpdate });
  }

  return (
    <Card className="max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <UserCogIcon className="mr-2 h-6 w-6 text-primary" />
          Informações do Usuário
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Carlos Alberto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (Não editável)</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} disabled className="bg-muted/50" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Perfil de Acesso</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o perfil" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="operator">Operador (Motorista)</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status do Usuário</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <CardFooter className="px-0 pt-6">
              <Button type="submit" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? 'Salvando...' : <><SaveIcon className="mr-2 h-4 w-4" /> Salvar Alterações</>}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
