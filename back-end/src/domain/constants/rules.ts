// UniLib Core Business Rules & Invariants

export const RULES = {
  // Maximum active loans allowed per borrower (both Student and Lecturer)
  MAX_ACTIVE_LOANS: 5,

  // Standard loan period in calendar days
  LOAN_DURATION_DAYS: 14,

  // Maximum number of renewals per loan
  MAX_RENEWALS: 2,

  // Additional days granted per renewal
  RENEWAL_EXTENSION_DAYS: 7,

  // Late fee per copy per calendar day (THB)
  LATE_FINE_PER_DAY: 10,

  // Maximum cap on late fine per loan (THB)
  MAX_LATE_FINE_PER_LOAN: 1000,

  // Outstanding balance threshold (THB) that triggers borrowing/renewing/reserving block
  FINE_BLOCK_THRESHOLD: 500,

  // Maximum concurrent active reservations per borrower
  MAX_ACTIVE_RESERVATIONS: 3,

  // Hold expiration window for allocated reservations (Hours)
  RESERVATION_HOLD_HOURS: 48,

  // Flat processing fee for lost or unusable books (THB)
  LOST_PROCESSING_FEE: 200,

  // Minor damage flat charge (THB)
  MINOR_DAMAGE_CHARGE: 100,

  // Major damage rate (% of Acquisition Price)
  MAJOR_DAMAGE_RATE: 0.50,

  // System business timezone
  SYSTEM_TIMEZONE: 'Asia/Bangkok',
} as const;

export enum UserRole {
  STUDENT = 'STUDENT',
  LECTURER = 'LECTURER',
  LIBRARIAN = 'LIBRARIAN',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export enum CopyStatus {
  AVAILABLE = 'AVAILABLE',
  ON_LOAN = 'ON_LOAN',
  ON_HOLD = 'ON_HOLD',
  MAINTENANCE = 'MAINTENANCE',
  LOST = 'LOST',
  RETIRED = 'RETIRED',
}

export enum LoanStatus {
  ACTIVE = 'ACTIVE',
  RETURNED = 'RETURNED',
  LOST = 'LOST',
}

export enum ReservationStatus {
  PENDING = 'PENDING',
  ON_HOLD = 'ON_HOLD',
  FULFILLED = 'FULFILLED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum ChargeType {
  LATE_FINE = 'LATE_FINE',
  LOST_REPLACEMENT = 'LOST_REPLACEMENT',
  PROCESSING_FEE = 'PROCESSING_FEE',
  DAMAGE_CHARGE = 'DAMAGE_CHARGE',
}

export enum FineStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  WAIVED = 'WAIVED',
}

export enum DamageCondition {
  NORMAL = 'NORMAL',
  MINOR_DAMAGE = 'MINOR_DAMAGE',
  MAJOR_DAMAGE = 'MAJOR_DAMAGE',
  UNUSABLE = 'UNUSABLE',
}
