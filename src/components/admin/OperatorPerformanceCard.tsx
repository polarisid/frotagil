typescriptreact
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface OperatorPerformanceCardProps {
  operatorName: string;
  dailyMileage: { date: string; mileage: number }[];
  weeklyMileage: number;
  numberOfIncidents: number;
  numberOfChecklists: number;
}

const OperatorPerformanceCard: React.FC<OperatorPerformanceCardProps> = ({
  operatorName,
  dailyMileage,
  weeklyMileage,
  numberOfIncidents,
  numberOfChecklists,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{operatorName}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>
          <strong>KM Rodado na Semana:</strong> {weeklyMileage.toFixed(2)} km
        </p>
        <Separator className="my-2" />
        <div>
          <strong>KM Rodado por Dia:</strong>
          <ul>
            {dailyMileage.map((data, index) => (
              <li key={index}>
                {data.date}: {data.mileage.toFixed(2)} km
              </li>
            ))}
          </ul>
        </div>
        <Separator className="my-2" />
        <p>
          <strong>Número de Ocorrências:</strong> {numberOfIncidents}
        </p>
        <Separator className="my-2" />
        <p>
          <strong>Número de Checklists:</strong> {numberOfChecklists}
        </p>
      </CardContent>
    </Card>
  );
};

export default OperatorPerformanceCard;