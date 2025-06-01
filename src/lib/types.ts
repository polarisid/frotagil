
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
  mileage?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'operator' | 'admin';
  status?: 'active' | 'inactive';
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
}

export interface Incident {
  id: string;
  vehicleId: string;
  operatorId: string;
  operatorName: string;
  date: string;
  description: string;
  attachments?: string[];
  status: 'under_analysis' | 'resolved' | 'pending_action' | 'reported';
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
  initialMileage?: number; // KM at pickup
  finalMileage?: number;   // KM at return
  kmDriven?: number;       // Calculated: finalMileage - initialMileage
}

// New type for managing checklist item definitions
export interface ChecklistItemDefinition {
  docId: string; // Firestore document ID
  itemId: string;      // Unique short identifier (e.g., "tires", "lights"), used as id in ChecklistItem[]
  label: string;       // The question/text for the checklist item
  order: number;       // For display order
  isActive: boolean;   // To allow soft-deleting or disabling items
}

