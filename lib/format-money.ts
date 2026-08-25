/**
 * Small display helpers for money values in the Payment & Cost-Splitting module.
 *
 * All monetary amounts are stored and transported in the smallest currency unit
 * (paise) as integers, per the module spec (§9). These pure helpers convert
 * between that storage unit and the rupee values a Provider actually types and
 * a rider reads ("≈ ₹120/person").
 */

/** Formats a paise amount as a rupee string, e.g. 12000 -> "₹120.00". */
export function formatRupees(
  paise: number | string | { toString(): string } | null | undefined
): string {
  if (paise === null || paise === undefined || paise === '') return '';
  const value = Number(paise);
  if (!Number.isFinite(value)) return '';
  return `₹${(value / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/** Converts a rupee amount (e.g. 120 or 120.5) to the nearest paise integer. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Converts a stored paise integer back to a rupee number for inputs. */
export function paiseToRupees(paise: number | string | { toString(): string } | null | undefined): number {
  if (paise === null || paise === undefined || paise === '') return 0;
  const value = Number(paise);
  return Number.isFinite(value) ? value / 100 : 0;
}
