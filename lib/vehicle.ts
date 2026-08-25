/**
 * Shared vehicle display helpers for the Ride Feed / Ride Detail views.
 */

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  SEDAN: 'Sedan',
  SUV: 'SUV',
  HATCHBACK: 'Hatchback',
  VAN: 'Van',
  COUPE: 'Coupe',
  CONVERTIBLE: 'Convertible',
  TRUCK: 'Truck',
  OTHER: 'Other'
};

export function vehicleTypeLabel(type: string): string {
  return VEHICLE_TYPE_LABELS[type] ?? type;
}
