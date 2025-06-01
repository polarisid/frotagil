
'use client';

import { Container } from '@/components/shared/Container';
import { PageTitle } from '@/components/shared/PageTitle';
import { NewVehicleForm } from '@/components/admin/NewVehicleForm';
import { useRouter } from 'next/navigation';

export default function NewVehiclePage() {
  const router = useRouter();

  const handleFormSubmitSuccess = () => {
    router.push('/admin/vehicles'); // Redirect to the list of vehicles after successful creation
  };

  return (
    <Container>
      <PageTitle
        title="Cadastrar Novo Veículo"
        description="Preencha os dados abaixo para adicionar um novo veículo à frota."
      />
      <NewVehicleForm onFormSubmitSuccess={handleFormSubmitSuccess} />
    </Container>
  );
}
