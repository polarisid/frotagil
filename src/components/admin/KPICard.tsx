import type { KPI } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KPICardProps {
  kpi: KPI;
}

export function KPICard({ kpi }: KPICardProps) {
  const Icon = kpi.icon;
  return (
    <Card className={cn("shadow-lg hover:shadow-xl transition-shadow border-border/50", kpi.bgColorClass)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-foreground/90 dark:text-foreground/80">{kpi.title}</CardTitle>
        <Icon className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{kpi.value}</div>
      </CardContent>
    </Card>
  );
}
