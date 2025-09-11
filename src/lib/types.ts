

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  make: string;
  year: number;
  acquisitionDate: string;
  status: 'active' | 'maintenance' | 'inactive';
  imageUrl?: string;
  assignedOperatorId?: string | null;
  mileage?: number;
  initialMileageSystem?: number; // KM no momento do cadastro no sistema
  pickedUpDate?: string | null;
}

export interface ChecklistItem {
  id: string; // Corresponds to ChecklistItemDefinition.itemId
  label: string;
  value: boolean | null; // true for Yes/OK, false for No/Nok, null for N/A (if implemented)
}

export interface Checklist {
  id: string;
  vehicleId: string;
  operatorId: string;
  operatorName: string;
  date: string;
  items: ChecklistItem[];
  observations: string;
  signature: string;
  mileage: number; // Tornando obrigatório para garantir consistência
  routeDescription?: string; 
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'operator' | 'admin';
  status?: 'active' | 'inactive';
}

export interface WorkshopChecklistItem {
    id: string;
    label: string;
    value: 'ok' | 'nok' | 'na'; // Conforme, Não Conforme, Não se Aplica
}

export interface WorkshopChecklist {
    dropOffItems: WorkshopChecklistItem[];
    pickUpItems: WorkshopChecklistItem[];
}


export interface Maintenance {
  id: string;
  vehicleId: string;
  type: 'preventive' | 'corrective';
  description: string;
  scheduledDate?: string;
  scheduledKm?: number;
  priority: 'low' | 'medium' | 'high';
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  cost?: number;
  observations?: string;
  attachments?: string[];
  completionDate?: string;

  // New fields for workshop flow
  workshopName?: string;
  workshopDropOffDate?: string; // ISO String
  workshopPickUpDate?: string; // ISO String
  workshopChecklist?: WorkshopChecklist;
  workshopDropOffObservations?: string;
  workshopPickUpObservations?: string;

}

export interface Incident {
  id: string;
  vehicleId: string;
  operatorId: string;
  operatorName: string;
  date: string;
  description: string;
  attachments?: string[];
  status: 'under_analysis' | 'resolved' | 'pending_action' | 'reported' | 'cancelled';
}

export type KPI = {
  title: string;
  value: string | number;
  icon: React.ElementType;
  bgColorClass?: string;
  href?: string;
};

export interface ChecklistTableProps {
  checklists: Checklist[];
  vehicles: Vehicle[];
  isAdminView?: boolean;
}

export interface VehicleUsageLog {
  id: string;
  vehicleId: string;
  vehiclePlate: string; // Denormalized for easier display
  operatorId: string;
  operatorName: string; // Denormalized
  pickedUpTimestamp: string; // ISO string
  returnedTimestamp?: string | null; // ISO string, null if still in use
  durationMinutes?: number; // Calculated on return
  status: 'active' | 'completed'; // 'active' if currently in use
  initialMileage: number; // KM at pickup, now mandatory
  finalMileage?: number;   // KM at return
  kmDriven?: number;       // Calculated: finalMileage - initialMileage
  routeDescription?: string; 
}

// New type for managing checklist item definitions
export interface ChecklistItemDefinition {
  docId: string; // Firestore document ID
  itemId: string;      // Unique short identifier (e.g., "tires", "lights"), used as id in ChecklistItem[]
  label: string;       // The question/text for the checklist item
  order: number;       // For display order
  isActive: boolean;   // To allow soft-deleting or disabling items
}

// Types for Admin Reports
export interface OperatorPerformanceReportItem {
  operatorId: string;
  operatorName: string;
  kmDrivenThisWeek: number;
  kmDrivenThisMonth: number;
  totalIncidentsReported: number;
  totalChecklistsSubmitted: number;
}

export interface VehicleMileageReportItem {
  vehicleId: string;
  plate: string;
  make: string;
  model: string;
  kmDrivenThisWeek: number;
  kmDrivenThisMonth: number;
  totalMileage?: number;
  lastPickedUpDate?: string | null;
  acquisitionDate: string;
  initialMileageSystem?: number;
}

export interface VehicleCostReportItem {
  vehicleId: string;
  plate: string;
  make: string;
  model: string;
  totalMaintenanceCostThisMonth: number;
  totalFineAmountThisMonth: number;
  totalCostThisMonth: number;
  totalMaintenanceCostThisYear: number;
  totalFineAmountThisYear: number;
  totalCostThisYear: number;
}

export interface Fine {
  id: string;
  operatorId: string;
  operatorName: string; // Denormalized for easier display
  vehicleId: string;
  vehiclePlate: string; // Denormalized for easier display
  infractionCode: string;
  description: string;
  location: string;
  date: string; // ISO string - Date and time of infraction
  dueDate: string; // ISO string - Due date for payment/appeal
  amount: number;
  status: 'pending' | 'paid' | 'appealed' | 'cancelled';
  attachments?: string[]; // URLs of attachments (e.g., scan of the fine)
  adminNotes?: string; // Internal notes for administrators
  createdAt: string; // ISO string - Date when the fine was registered in the system
}

export type VehicleHistoryEvent = {
  type: 'checklist' | 'maintenance' | 'incident' | 'usage';
  date: string; // ISO String for sorting
  data: Checklist | Maintenance | Incident | VehicleUsageLog;
};

