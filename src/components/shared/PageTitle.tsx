import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageTitleProps {
  title: string;
  description?: string | ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageTitle({ title, description, actions, className }: PageTitleProps) {
  return (
    <div className={cn('mb-6 md:mb-8', className)}>
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          {description}
        </p>
      )}
    </div>
  );
}
