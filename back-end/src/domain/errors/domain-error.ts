export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}

export const DomainErrors = {
  BOOK_NOT_FOUND: (id: string) =>
    new DomainError('BOOK_NOT_FOUND', `Book with ID '${id}' was not found`, 404),

  COPY_NOT_FOUND: (barcodeOrId: string) =>
    new DomainError('COPY_NOT_FOUND', `Physical copy '${barcodeOrId}' was not found`, 404),

  COPY_NOT_AVAILABLE: (status: string) =>
    new DomainError('COPY_NOT_AVAILABLE', `Physical copy is currently '${status}' and cannot be borrowed`, 409),

  USER_NOT_FOUND: (id: string) =>
    new DomainError('USER_NOT_FOUND', `User with ID '${id}' was not found`, 404),

  USER_DISABLED: () =>
    new DomainError('USER_DISABLED', 'User account is disabled', 403),

  LOAN_LIMIT_EXCEEDED: (current: number, max: number) =>
    new DomainError('LOAN_LIMIT_EXCEEDED', `Borrower already has ${current} active loans (maximum ${max})`, 422),

  DUPLICATE_ACTIVE_LOAN: (bookTitle: string) =>
    new DomainError('DUPLICATE_ACTIVE_LOAN', `Borrower already holds an active copy of '${bookTitle}'`, 409),

  USER_HAS_OVERDUE_LOAN: () =>
    new DomainError('USER_HAS_OVERDUE_LOAN', 'Borrower has one or more overdue loans and cannot borrow or renew', 422),

  FINE_LIMIT_EXCEEDED: (outstanding: number, limit: number) =>
    new DomainError('FINE_LIMIT_EXCEEDED', `Outstanding fine balance of ${outstanding} THB exceeds the allowed limit of ${limit} THB`, 422),

  RENEW_LIMIT_EXCEEDED: (current: number, max: number) =>
    new DomainError('RENEW_LIMIT_EXCEEDED', `Loan has already reached the maximum of ${max} renewals`, 422),

  RENEW_OVERDUE_LOAN: () =>
    new DomainError('RENEW_OVERDUE_LOAN', 'Cannot renew a loan that is already overdue', 422),

  RENEW_BLOCKED_BY_RESERVATION: () =>
    new DomainError('RENEW_BLOCKED_BY_RESERVATION', 'Cannot renew because there are active reservations queued for this book', 409),

  BOOK_CURRENTLY_AVAILABLE: () =>
    new DomainError('BOOK_CURRENTLY_AVAILABLE', 'Cannot reserve because there are physical copies available in the library right now', 400),

  RESERVATION_LIMIT_EXCEEDED: (current: number, max: number) =>
    new DomainError('RESERVATION_LIMIT_EXCEEDED', `User already has ${current} active reservations (maximum ${max})`, 422),

  RESERVATION_ALREADY_EXISTS: () =>
    new DomainError('RESERVATION_ALREADY_EXISTS', 'User already has an active reservation for this book', 409),

  RESERVATION_BORROWING_OWN: () =>
    new DomainError('RESERVATION_BORROWING_OWN', 'User cannot reserve a book that they are currently borrowing', 409),

  PAYMENT_EXCEEDS_OUTSTANDING: (payment: number, outstanding: number) =>
    new DomainError('PAYMENT_EXCEEDS_OUTSTANDING', `Payment amount ${payment} THB exceeds outstanding balance ${outstanding} THB`, 400),

  INVALID_AMOUNT: (msg: string = 'Amount must be greater than zero') =>
    new DomainError('INVALID_AMOUNT', msg, 400),

  UNAUTHORIZED: (msg: string = 'Authentication required') =>
    new DomainError('UNAUTHORIZED', msg, 401),

  FORBIDDEN: (msg: string = 'Permission denied') =>
    new DomainError('FORBIDDEN', msg, 403),

  CONCURRENT_CONFLICT: (msg: string = 'Resource was modified by another concurrent transaction') =>
    new DomainError('CONCURRENT_CONFLICT', msg, 409),
};
