
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
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
import { LogInIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase'; 
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth'; 

const formSchema = z.object({
  email: z.string().email({ message: 'Por favor, insira um email válido.' }),
  password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
});

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const authContext = useAuth(); 

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth || !db) {
      toast({
        variant: "destructive",
        title: "Erro de Configuração do Sistema",
        description: "O sistema de autenticação não está configurado corretamente. Por favor, contate o suporte técnico ou verifique as variáveis de ambiente do Firebase (se for um administrador) e reinicie o servidor.",
      });
      console.warn("LoginForm: Firebase auth or db is not initialized. This is likely due to missing Firebase environment variables in .env.local or an issue with Firebase initialization in src/lib/firebase.ts.");
      return;
    }

    form.clearErrors(); // Clear previous errors

    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const firebaseUser = userCredential.user;

      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.status === 'inactive') {
            toast({ variant: "destructive", title: 'Conta Inativa', description: 'Sua conta está inativa. Por favor, entre em contato com o administrador.' });
            if (auth) await auth.signOut();
            return;
        }

        toast({
          title: 'Login Bem-sucedido!',
          description: `Bem-vindo, ${userData.name}! Redirecionando...`,
        });

        // The AuthProvider will handle setting currentUser and redirecting if necessary
        // For direct navigation based on role:
        if (userData.role === 'operator') {
          router.push('/operator/dashboard');
        } else if (userData.role === 'admin') {
          router.push('/admin/dashboard');
        } else {
           toast({ variant: "destructive", title: 'Erro de Perfil', description: 'Perfil de usuário desconhecido.' });
           if (auth) await auth.signOut();
        }
      } else {
        toast({ variant: "destructive", title: 'Erro de Login', description: 'Dados do usuário não encontrados no sistema. Verifique suas credenciais ou contate o suporte.' });
        if (auth) await auth.signOut(); 
      }
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = 'Ocorreu um erro durante o login. Tente novamente.';
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorMessage = 'Email ou senha inválidos. Verifique suas credenciais.';
            form.setError("email", { type: "manual", message: " " }); // Add error to form
            form.setError("password", { type: "manual", message: " " });
            break;
          case 'auth/invalid-api-key':
          case 'auth/internal-error': // Catch generic internal Firebase errors too
             errorMessage = 'Erro de configuração do Firebase. Contate o administrador do sistema.';
            break;
          default:
            errorMessage = `Erro de login: ${error.message}`; // More specific error if available
        }
      }
      toast({ variant: 'destructive', title: 'Falha no Login', description: errorMessage });
    }
  }
  
  if (authContext?.loading) {
    return <p className="text-center text-muted-foreground">Carregando autenticação...</p>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="seu@email.com" {...field} />
              </FormControl>
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
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Entrando...' : <><LogInIcon className="mr-2 h-4 w-4" /> Entrar</>}
        </Button>
      </form>
    </Form>
  );
}
