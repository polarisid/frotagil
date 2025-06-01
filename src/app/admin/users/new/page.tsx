
'use client';

import { Container } from '@/components/shared/Container';
import { PageTitle } from '@/components/shared/PageTitle';
import { NewUserForm } from '@/components/admin/NewUserForm';
import { useRouter } from 'next/navigation';

export default function NewUserPage() {
  const router = useRouter();

  const handleFormSubmitSuccess = () => {
    router.push('/admin/users');
  };

  return (
    <Container>
      <PageTitle
        title="Adicionar Novo Usuário"
        description="Preencha os dados abaixo para criar um novo usuário no sistema."
      />
      <NewUserForm onFormSubmitSuccess={handleFormSubmitSuccess} />
    </Container>
  );
}
