import { LoginForm } from '@/components/auth/LoginForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TruckIcon } from 'lucide-react';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4">
      <div className="mb-8 flex flex-col items-center text-center">
        <TruckIcon className="mb-4 h-16 w-16 text-primary" />
        <h1 className="text-4xl font-bold text-primary">FrotaÁgil</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Bem-vindo ao seu sistema de gestão de frotas.
        </p>
      </div>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Acessar Sistema</CardTitle>
          <CardDescription>
            Selecione seu perfil e insira suas credenciais.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} FrotaÁgil. Todos os direitos reservados. Projetado por Daniel Carvalho
      </footer>
    </main>
  );
}
