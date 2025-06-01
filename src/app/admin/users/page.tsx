
'use client';

import { PageTitle } from '@/components/shared/PageTitle';
import { Container } from '@/components/shared/Container';
import { UserTable } from '@/components/admin/UserTable';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircleIcon, SearchIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { getUsers } from '@/lib/services/userService';
import type { User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';

export default function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: users, isLoading, error } = useQuery<User[], Error>({
    queryKey: ['users'],
    queryFn: getUsers,
  });

  const filteredUsers = users?.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];


  if (isLoading) {
    return (
      <Container>
        <PageTitle title="Gerenciamento de Usuários" description="Carregando usuários..." />
        <Card className="mb-6 shadow">
          <CardContent className="p-4">
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Skeleton className="h-64 w-full" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <PageTitle title="Erro" description={`Não foi possível carregar os usuários: ${error.message}`} />
      </Container>
    );
  }

  return (
    <Container>
      <PageTitle
        title="Gerenciamento de Usuários"
        description="Adicione, edite ou visualize os usuários do sistema."
        actions={
          <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link href="/admin/users/new">
              <PlusCircleIcon className="mr-2 h-4 w-4" />
              Adicionar Usuário
            </Link>
          </Button>
        }
      />

      <Card className="mb-6 shadow">
        <CardContent className="p-4">
            <div className="flex items-center gap-4">
                <div className="relative flex-grow">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar por nome ou email..." 
                      className="pl-10" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {/* <Button variant="outline">Buscar</Button> Search is live */}
            </div>
        </CardContent>
      </Card>

      <UserTable users={filteredUsers} />
    </Container>
  );
}
