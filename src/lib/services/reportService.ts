

'use server';

import { getUsers } from './userService';
import { getVehicles } from './vehicleService';
import { getUsageLogsForPeriod } from './vehicleUsageLogService';
import { getIncidents } from './incidentService';
import { getChecklists } from './checklistService';
import { getMaintenances } from './maintenanceService';
import { getFines } from './fineService';
import type { User, Vehicle, VehicleUsageLog, Incident, Checklist, OperatorPerformanceReportItem, VehicleMileageReportItem, VehicleCostReportItem, Maintenance, Fine } from '@/lib/types';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO, isValid, getYear, startOfYear, endOfYear } from 'date-fns';

const calculateTotalKm = (logs: VehicleUsageLog[]): number => {
  return logs.reduce((sum, log) => sum + (log.kmDriven || 0), 0);
};

export async function getOperatorPerformanceReport(referenceDate: Date): Promise<OperatorPerformanceReportItem[]> {
  const allOperators = await getUsers();
  const activeOperators = allOperators.filter(u => u.role === 'operator' && (u.status === 'active' || u.status === undefined)); 
  const reportItems: OperatorPerformanceReportItem[] = [];

  const sow = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const eow = endOfWeek(referenceDate, { weekStartsOn: 1 });
  const som = startOfMonth(referenceDate);
  const eom = endOfMonth(referenceDate);

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

export async function getVehicleCostReport(referenceDate: Date): Promise<VehicleCostReportItem[]> {
  const allVehicles = await getVehicles();
  const reportItems: VehicleCostReportItem[] = [];

  const som = startOfMonth(referenceDate);
  const eom = endOfMonth(referenceDate);
  const soy = startOfYear(referenceDate);
  const eoy = endOfYear(referenceDate);

  // Fetch all maintenances (without date filter at service level for now)
  const allMaintenances = await getMaintenances(); 
  // Fetch fines for the entire year of the referenceDate
  const allFinesForYear = await getFines({
    startDate: soy.toISOString().split('T')[0],
    endDate: eoy.toISOString().split('T')[0],
  });

  for (const vehicle of allVehicles) {
    let totalMaintenanceCostThisMonth = 0;
    let totalFineAmountThisMonth = 0;
    let totalMaintenanceCostThisYear = 0;
    let totalFineAmountThisYear = 0;

    // Calculate maintenance costs
    allMaintenances
      .filter(maint => maint.vehicleId === vehicle.id)
      .forEach(maint => {
        let dateToCheck: Date | null = null;
        if (maint.status === 'completed' && maint.completionDate) {
          dateToCheck = parseISO(maint.completionDate);
        } else if ((maint.status === 'planned' || maint.status === 'in_progress') && maint.scheduledDate) {
          // For planned/in_progress, use scheduledDate if it's within the period
          dateToCheck = parseISO(maint.scheduledDate);
        }
        
        if (dateToCheck && isValid(dateToCheck)) {
          if (isWithinInterval(dateToCheck, { start: som, end: eom })) {
            totalMaintenanceCostThisMonth += maint.cost || 0;
          }
          if (isWithinInterval(dateToCheck, { start: soy, end: eoy })) {
            totalMaintenanceCostThisYear += maint.cost || 0;
          }
        }
      });

    // Calculate fine amounts
    allFinesForYear
      .filter(fine => fine.vehicleId === vehicle.id && (fine.status === 'pending' || fine.status === 'paid'))
      .forEach(fine => {
        // Fines are already filtered for the year by getFines
        totalFineAmountThisYear += fine.amount || 0;
        
        // Check if the fine's infraction date is within the reference month
        const fineInfractionDate = parseISO(fine.date);
        if (isValid(fineInfractionDate) && isWithinInterval(fineInfractionDate, { start: som, end: eom })) {
            totalFineAmountThisMonth += fine.amount || 0;
        }
      });

    const totalCostThisMonth = totalMaintenanceCostThisMonth + totalFineAmountThisMonth;
    const totalCostThisYear = totalMaintenanceCostThisYear + totalFineAmountThisYear;

    // Add to report if there are any costs in the year, to allow viewing details even if monthly is zero
    if (totalCostThisYear > 0 || totalCostThisMonth > 0) { 
      reportItems.push({
        vehicleId: vehicle.id,
        plate: vehicle.plate,
        make: vehicle.make,
        model: vehicle.model,
        totalMaintenanceCostThisMonth,
        totalFineAmountThisMonth,
        totalCostThisMonth,
        totalMaintenanceCostThisYear,
        totalFineAmountThisYear,
        totalCostThisYear,
      });
    }
  }
  return reportItems.sort((a,b) => b.totalCostThisYear - a.totalCostThisYear); // Sort by total yearly cost
}

