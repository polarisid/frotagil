
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
import { UserPlusIcon, SaveIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addUser as addUserToFirestore, getUserByEmail } from '@/lib/services/userService';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const newUserFormSchema = z.object({
  name: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres." }).max(100, { message: "Nome muito longo."}),
  email: z.string().email({ message: "Email inválido." }),
  role: z.enum(['operator', 'admin'], { required_error: "Perfil é obrigatório." }),
  password: z.string().min(6, { message: "Senha deve ter pelo menos 6 caracteres." }),
  confirmPassword: z.string().min(6, { message: "Confirmação de senha deve ter pelo menos 6 caracteres." })
}).refine(data => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"], 
});

type NewUserFormValues = z.infer<typeof newUserFormSchema>;

interface NewUserFormProps {
  onFormSubmitSuccess: () => void;
}

export function NewUserForm({ onFormSubmitSuccess }: NewUserFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserFormSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'operator',
      password: '',
      confirmPassword: '',
    },
  });

  const addUserMutation = useMutation< User, Error, { authUid: string; values: NewUserFormValues } >({
    mutationFn: async ({ authUid, values }) => {
        const firestoreUserData: Omit<User, 'id' | 'status'> = {
            name: values.name,
            email: values.email,
            role: values.role,
        };
        // addUserToFirestore now accepts authUid as the first argument
        return addUserToFirestore(authUid, firestoreUserData);
    },
    onSuccess: (data) => {
      toast({
        title: 'Usuário Criado!',
        description: `O usuário ${data.name} foi adicionado com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onFormSubmitSuccess();
      form.reset();
    },
    onError: (error: any) => {
      // If Firestore user creation fails after Firebase Auth user creation,
      // ideally, you'd delete the Firebase Auth user or handle this inconsistency.
      // For now, just show an error.
      toast({
        variant: "destructive",
        title: "Erro ao Salvar Detalhes do Usuário",
        description: error.message || "Não foi possível salvar os detalhes do usuário no Firestore.",
      });
    },
  });


  async function onSubmit(values: NewUserFormValues) {
    // Check if email already exists in Firestore (optional, Firebase Auth will also check)
    const existingUser = await getUserByEmail(values.email);
    if (existingUser) {
      form.setError("email", { type: "manual", message: "Este email já está em uso." });
      toast({
        variant: "destructive",
        title: "Erro ao Criar Usuário",
        description: "O email fornecido já está cadastrado no sistema.",
      });
      return;
    }

    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const authUser = userCredential.user;

      // 2. Add user details to Firestore, using the UID from Firebase Auth
      addUserMutation.mutate({ authUid: authUser.uid, values });

    } catch (error: any) {
      console.error("Firebase Auth user creation error: ", error);
      let errorMessage = "Ocorreu um erro ao criar o usuário.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Este email já está registrado.";
        form.setError("email", { type: "manual", message: errorMessage });
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "A senha é muito fraca. Por favor, escolha uma senha mais forte.";
        form.setError("password", { type: "manual", message: errorMessage });
      }
      toast({
        variant: "destructive",
        title: "Erro de Autenticação",
        description: errorMessage,
      });
    }
  }

  return (
    <Card className="max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <UserPlusIcon className="mr-2 h-6 w-6 text-primary" />
          Detalhes do Novo Usuário
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Ex: carlos.alberto@example.com" {...field} />
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar Senha</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Repita a senha" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <CardFooter className="px-0 pt-6">
              <Button type="submit" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={addUserMutation.isPending || form.formState.isSubmitting}>
                {addUserMutation.isPending || form.formState.isSubmitting ? 'Salvando...' : <><SaveIcon className="mr-2 h-4 w-4" /> Salvar Usuário</>}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
