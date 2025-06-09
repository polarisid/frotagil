
'use client';

import type { User } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Edit3Icon, MoreHorizontalIcon, UserCogIcon, UserCheck2Icon, UserX2Icon, KeyIcon, MailWarningIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateUser, sendPasswordResetEmailToUser } from '@/lib/services/userService'; 
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from 'react';

interface UserTableProps {
  users: User[];
}

export function UserTable({ users }: UserTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isResetPasswordAlertOpen, setIsResetPasswordAlertOpen] = useState(false);
  const [userToResetPassword, setUserToResetPassword] = useState<User | null>(null);

  const updateUserStatusMutation = useMutation<void, Error, { userId: string; status: 'active' | 'inactive' }>({
    mutationFn: ({ userId, status }) => updateUser(userId, { status }),
    onSuccess: (_, { status }) => {
      toast({
        title: `Usuário ${status === 'active' ? 'Reativado' : 'Desativado'}`,
        description: `O status do usuário foi alterado com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao Atualizar Status',
        description: error.message || 'Não foi possível alterar o status do usuário.',
      });
    },
  });

  const sendPasswordResetMutation = useMutation({
    mutationFn: (email: string) => sendPasswordResetEmailToUser(email),
    onSuccess: (_, email) => {
      toast({
        title: 'Email de Redefinição Enviado',
        description: `Um email para redefinição de senha foi enviado para ${email}.`,
      });
    },
    onError: (error: Error, email) => {
       toast({
        variant: 'destructive',
        title: 'Erro ao Enviar Email',
        description: `Não foi possível enviar o email para ${email}. Detalhes: ${error.message}`,
      });
    }
  });


  const handleToggleUserStatus = (userId: string, currentStatus: 'active' | 'inactive') => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    updateUserStatusMutation.mutate({ userId, status: newStatus });
  };

  const handleRequestPasswordReset = (user: User) => {
    setUserToResetPassword(user);
    setIsResetPasswordAlertOpen(true);
  };

  const confirmSendPasswordReset = () => {
    if (userToResetPassword?.email) {
      sendPasswordResetMutation.mutate(userToResetPassword.email);
    }
    setIsResetPasswordAlertOpen(false);
    setUserToResetPassword(null);
  };

  const roleDisplay = {
    admin: { label: 'Admin', icon: UserCogIcon, className: 'bg-primary/80 text-primary-foreground' },
    operator: { label: 'Operador', icon: UserCheck2Icon, className: 'bg-secondary text-secondary-foreground' },
  };

  return (
    <>
    <div className="overflow-hidden rounded-lg border shadow-md">
      <Table>
        <TableHeader className="bg-secondary">
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Perfil</TableHead>
            <TableHead className="hidden sm:table-cell">Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                Nenhum usuário encontrado.
              </TableCell>
            </TableRow>
          )}
          {users.map((user) => {
            const RoleIcon = roleDisplay[user.role]?.icon || UserCogIcon;
            const status = user.status || 'active'; 
            const statusConfig = {
                active: { label: 'Ativo', icon: UserCheck2Icon, className: 'bg-green-100 text-green-700 border-green-500'},
                inactive: { label: 'Inativo', icon: UserX2Icon, className: 'bg-red-100 text-red-700 border-red-500'}
            }
            const currentStatusConfig = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
            const StatusIcon = currentStatusConfig.icon;

            return (
            <TableRow key={user.id} className="hover:bg-muted/50">
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <Badge variant="outline" className={cn("text-xs", roleDisplay[user.role]?.className)}>
                  <RoleIcon className="mr-1 h-3 w-3" />
                  {roleDisplay[user.role]?.label || user.role}
                </Badge>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                 <Badge variant="outline" className={cn("text-xs capitalize", currentStatusConfig.className)}>
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {currentStatusConfig.label}
                 </Badge>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={updateUserStatusMutation.isLoading || sendPasswordResetMutation.isPending}>
                      <MoreHorizontalIcon className="h-4 w-4" />
                      <span className="sr-only">Ações</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Opções do Usuário</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/users/edit/${user.id}`}>
                        <Edit3Icon className="mr-2 h-4 w-4" /> Editar
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleRequestPasswordReset(user)}
                      className="text-orange-600 focus:text-orange-700 focus:bg-orange-100/50"
                    >
                      <KeyIcon className="mr-2 h-4 w-4" /> Enviar Redefinição de Senha
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {status === 'active' ? (
                        <DropdownMenuItem
                        onClick={() => handleToggleUserStatus(user.id, 'active')}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        disabled={updateUserStatusMutation.isLoading}
                        >
                        <UserX2Icon className="mr-2 h-4 w-4" /> Desativar
                        </DropdownMenuItem>
                    ) : (
                         <DropdownMenuItem
                         onClick={() => handleToggleUserStatus(user.id, 'inactive')}
                         className="text-green-600 focus:text-green-700 focus:bg-green-100/50"
                         disabled={updateUserStatusMutation.isLoading}
                         >
                         <UserCheck2Icon className="mr-2 h-4 w-4" /> Reativar
                         </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
        </TableBody>
      </Table>
    </div>

    <AlertDialog open={isResetPasswordAlertOpen} onOpenChange={(isOpen) => {
        setIsResetPasswordAlertOpen(isOpen);
        if (!isOpen) setUserToResetPassword(null);
    }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <MailWarningIcon className="mr-2 h-5 w-5 text-orange-500" />
              Confirmar Envio de Email de Redefinição
            </AlertDialogTitle>
            <AlertDialogDescription>
              Um email para redefinição de senha será enviado para 
              <span className="font-semibold"> {userToResetPassword?.email}</span>. 
              O usuário precisará seguir as instruções no email para criar uma nova senha.
              <br/><br/>
              Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSendPasswordReset}
              disabled={sendPasswordResetMutation.isPending}
              className={cn(buttonVariants({variant: 'default'}), "bg-accent hover:bg-accent/90 text-accent-foreground")}
            >
              {sendPasswordResetMutation.isPending ? "Enviando..." : "Enviar Email de Redefinição"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
