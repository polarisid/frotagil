
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Container } from '@/components/shared/Container';
import { PageTitle } from '@/components/shared/PageTitle';
import { EditUserForm } from '@/components/admin/EditUserForm';
import type { User } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { getUserById } from '@/lib/services/userService';

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const { data: user, isLoading, error } = useQuery<User | null, Error>({
    queryKey: ['user', userId],
    queryFn: () => getUserById(userId),
    enabled: !!userId,
  });


  const handleFormSubmitSuccess = () => {
    router.push('/admin/users');
  };

  if (isLoading) {
    return (
        <Container>
            <PageTitle title="Carregando Usuário..." description="Aguarde enquanto carregamos as informações do usuário." />
            <div className="space-y-4 max-w-2xl mx-auto">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-10 w-1/4" />
            </div>
        </Container>
    );
  }

   if (error) {
     return (
      <Container>
        <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Erro ao Carregar Usuário</AlertTitle>
          <AlertDescription>
            {error.message || "Não foi possível carregar os dados do usuário."}
          </AlertDescription>
          <Button asChild variant="link" className="mt-4">
            <Link href="/admin/users">Voltar para Lista de Usuários</Link>
          </Button>
        </Alert>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container>
        <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Erro: Usuário Não Encontrado</AlertTitle>
          <AlertDescription>
            O usuário que você está tentando editar não foi encontrado. 
            Por favor, verifique o ID ou retorne à lista de usuários.
          </AlertDescription>
          <Button asChild variant="link" className="mt-4">
            <Link href="/admin/users">Voltar para Lista de Usuários</Link>
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container>
      <PageTitle
        title={`Editar Usuário: ${user.name}`}
        description={`Atualize as informações do usuário ${user.email}.`}
      />
      <EditUserForm
        user={user}
        onFormSubmitSuccess={handleFormSubmitSuccess}
      />
    </Container>
  );
}
