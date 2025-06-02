
'use server';

import { getUsers } from './userService';
import { getVehicles } from './vehicleService';
import { getUsageLogsForPeriod } from './vehicleUsageLogService';
import { getIncidents } from './incidentService';
import { getChecklists } from './checklistService';
import type { User, Vehicle, VehicleUsageLog, Incident, Checklist, OperatorPerformanceReportItem, VehicleMileageReportItem } from '@/lib/types';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

const calculateTotalKm = (logs: VehicleUsageLog[]): number => {
  return logs.reduce((sum, log) => sum + (log.kmDriven || 0), 0);
};

export async function getOperatorPerformanceReport(referenceDate: Date): Promise<OperatorPerformanceReportItem[]> {
  const allOperators = await getUsers();
  const activeOperators = allOperators.filter(u => u.role === 'operator' && (u.status === 'active' || u.status === undefined)); // Consider undefined status as active for backward compatibility
  const reportItems: OperatorPerformanceReportItem[] = [];

  const sow = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const eow = endOfWeek(referenceDate, { weekStartsOn: 1 });
  const som = startOfMonth(referenceDate);
  const eom = endOfMonth(referenceDate);

  // Fetch all relevant data once to optimize Firestore reads
  const monthlyUsageLogs = await getUsageLogsForPeriod(som, eom, 'completed');
  const allIncidents = await getIncidents(); 
  const allChecklists = await getChecklists(); 

  for (const operator of activeOperators) {
    const operatorMonthlyLogs = monthlyUsageLogs.filter(log => log.operatorId === operator.id);
    
    const operatorWeeklyLogs = operatorMonthlyLogs.filter(log => 
      log.pickedUpTimestamp && isWithinInterval(new Date(log.pickedUpTimestamp), { start: sow, end: eow })
    );

    const operatorIncidents = allIncidents.filter(incident => incident.operatorId === operator.id);
    const operatorChecklists = allChecklists.filter(checklist => checklist.operatorId === operator.id);

    reportItems.push({
      operatorId: operator.id,
      operatorName: operator.name,
      kmDrivenThisWeek: calculateTotalKm(operatorWeeklyLogs),
      kmDrivenThisMonth: calculateTotalKm(operatorMonthlyLogs),
      totalIncidentsReported: operatorIncidents.length,
      totalChecklistsSubmitted: operatorChecklists.length,
    });
  }
  return reportItems;
}

export async function getVehicleMileageReport(referenceDate: Date): Promise<VehicleMileageReportItem[]> {
  const allVehicles = await getVehicles();
  const activeVehicles = allVehicles.filter(v => v.status === 'active');
  const reportItems: VehicleMileageReportItem[] = [];

  const sow = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const eow = endOfWeek(referenceDate, { weekStartsOn: 1 });
  const som = startOfMonth(referenceDate);
  const eom = endOfMonth(referenceDate);
  
  const monthlyUsageLogs = await getUsageLogsForPeriod(som, eom, 'completed');

  for (const vehicle of activeVehicles) {
    const vehicleMonthlyLogs = monthlyUsageLogs.filter(log => log.vehicleId === vehicle.id);
    
    const vehicleWeeklyLogs = vehicleMonthlyLogs.filter(log => 
        log.pickedUpTimestamp && isWithinInterval(new Date(log.pickedUpTimestamp), { start: sow, end: eow })
    );

    reportItems.push({
      vehicleId: vehicle.id,
      plate: vehicle.plate,
      make: vehicle.make,
      model: vehicle.model,
      kmDrivenThisWeek: calculateTotalKm(vehicleWeeklyLogs),
      kmDrivenThisMonth: calculateTotalKm(vehicleMonthlyLogs),
    });
  }
  return reportItems;
}

