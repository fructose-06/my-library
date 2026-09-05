import { RULES, DamageCondition } from '../constants/rules.js';

export interface LateFineResult {
  lateDays: number;
  calculatedFine: number;
  cappedFine: number;
}

export interface LostBookChargeResult {
  acquisitionPrice: number;
  processingFee: number;
  accruedLateFine: number;
  totalCharge: number;
}

export interface DamageChargeResult {
  condition: DamageCondition;
  charge: number;
  nextStatus: string;
}

export class FineCalculator {
  /**
   * Calculate calendar date difference in Asia/Bangkok timezone
   * Calendar day format: YYYY-MM-DD
   */
  public static getBangkokDateString(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: RULES.SYSTEM_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  public static calculateCalendarDaysDifference(startDate: Date, endDate: Date): number {
    const startStr = this.getBangkokDateString(startDate);
    const endStr = this.getBangkokDateString(endDate);

    const startUtc = new Date(startStr + 'T00:00:00Z').getTime();
    const endUtc = new Date(endStr + 'T00:00:00Z').getTime();

    const diffDays = Math.round((endUtc - startUtc) / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Calculate late fine according to standard formula:
   * Late Days = max(0, Return Date - Due Date)
   * Late Fine = min(1000, Late Days * 10)
   */
  public static calculateLateFine(dueDate: Date, returnDate: Date): LateFineResult {
    const diff = this.calculateCalendarDaysDifference(dueDate, returnDate);
    const lateDays = Math.max(0, diff);
    const calculatedFine = lateDays * RULES.LATE_FINE_PER_DAY;
    const cappedFine = Math.min(RULES.MAX_LATE_FINE_PER_LOAN, calculatedFine);

    return {
      lateDays,
      calculatedFine,
      cappedFine,
    };
  }

  /**
   * Calculate charge for lost book:
   * Replacement = Acquisition Price + Processing Fee (200 THB) + Late Fine accrued before confirm lost
   */
  public static calculateLostCharges(
    acquisitionPrice: number,
    dueDate: Date,
    confirmLostDate: Date
  ): LostBookChargeResult {
    const { cappedFine } = this.calculateLateFine(dueDate, confirmLostDate);
    const processingFee = RULES.LOST_PROCESSING_FEE;
    const totalCharge = Number((acquisitionPrice + processingFee + cappedFine).toFixed(2));

    return {
      acquisitionPrice,
      processingFee,
      accruedLateFine: cappedFine,
      totalCharge,
    };
  }

  /**
   * Calculate damage charge and determine next copy status:
   * NORMAL: 0 THB -> AVAILABLE
   * MINOR_DAMAGE: 100 THB -> MAINTENANCE
   * MAJOR_DAMAGE: 50% of Acquisition Price -> MAINTENANCE
   * UNUSABLE: 100% of Acquisition Price + 200 THB -> RETIRED
   */
  public static calculateDamageCharge(
    condition: DamageCondition,
    acquisitionPrice: number
  ): DamageChargeResult {
    switch (condition) {
      case DamageCondition.NORMAL:
        return {
          condition,
          charge: 0,
          nextStatus: 'AVAILABLE',
        };

      case DamageCondition.MINOR_DAMAGE:
        return {
          condition,
          charge: RULES.MINOR_DAMAGE_CHARGE,
          nextStatus: 'MAINTENANCE',
        };

      case DamageCondition.MAJOR_DAMAGE:
        return {
          condition,
          charge: Number((acquisitionPrice * RULES.MAJOR_DAMAGE_RATE).toFixed(2)),
          nextStatus: 'MAINTENANCE',
        };

      case DamageCondition.UNUSABLE:
        return {
          condition,
          charge: Number((acquisitionPrice + RULES.LOST_PROCESSING_FEE).toFixed(2)),
          nextStatus: 'RETIRED',
        };

      default:
        return {
          condition: DamageCondition.NORMAL,
          charge: 0,
          nextStatus: 'AVAILABLE',
        };
    }
  }
}
