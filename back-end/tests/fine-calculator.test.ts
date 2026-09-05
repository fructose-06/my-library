import { describe, it, expect } from 'vitest';
import { FineCalculator } from '../src/domain/services/fine-calculator.js';
import { DamageCondition } from '../src/domain/constants/rules.js';

describe('FineCalculator Unit Tests', () => {
  it('calculates 0 late fee when returned on due date', () => {
    const dueDate = new Date('2026-09-10T09:00:00Z');
    const returnDate = new Date('2026-09-10T15:00:00Z');

    const res = FineCalculator.calculateLateFine(dueDate, returnDate);
    expect(res.lateDays).toBe(0);
    expect(res.calculatedFine).toBe(0);
    expect(res.cappedFine).toBe(0);
  });

  it('calculates 10 THB when returned 1 calendar day late', () => {
    const dueDate = new Date('2026-09-10T12:00:00Z');
    const returnDate = new Date('2026-09-11T08:00:00Z');

    const res = FineCalculator.calculateLateFine(dueDate, returnDate);
    expect(res.lateDays).toBe(1);
    expect(res.calculatedFine).toBe(10);
    expect(res.cappedFine).toBe(10);
  });

  it('calculates 70 THB for 7 days late', () => {
    const dueDate = new Date('2026-09-10T12:00:00Z');
    const returnDate = new Date('2026-09-17T12:00:00Z');

    const res = FineCalculator.calculateLateFine(dueDate, returnDate);
    expect(res.lateDays).toBe(7);
    expect(res.calculatedFine).toBe(70);
    expect(res.cappedFine).toBe(70);
  });

  it('caps late fine at 1,000 THB when calculated amount exceeds 1,000 THB', () => {
    // 125 days late * 10 = 1,250 THB -> should cap at 1,000 THB
    const dueDate = new Date('2026-01-01T00:00:00Z');
    const returnDate = new Date('2026-05-06T00:00:00Z');

    const res = FineCalculator.calculateLateFine(dueDate, returnDate);
    expect(res.calculatedFine).toBeGreaterThan(1000);
    expect(res.cappedFine).toBe(1000);
  });

  it('calculates lost book charge accurately with processing fee and late fine', () => {
    const price = 850;
    const dueDate = new Date('2026-09-01T00:00:00Z');
    const confirmLostDate = new Date('2026-09-13T00:00:00Z'); // 12 days late = 120 THB

    const res = FineCalculator.calculateLostCharges(price, dueDate, confirmLostDate);
    expect(res.acquisitionPrice).toBe(850);
    expect(res.processingFee).toBe(200);
    expect(res.accruedLateFine).toBe(120);
    expect(res.totalCharge).toBe(1170);
  });

  it('calculates damage charges according to conditions', () => {
    const price = 1000;

    // Normal: 0 THB, copy AVAILABLE
    const normal = FineCalculator.calculateDamageCharge(DamageCondition.NORMAL, price);
    expect(normal.charge).toBe(0);
    expect(normal.nextStatus).toBe('AVAILABLE');

    // Minor Damage: 100 THB, copy MAINTENANCE
    const minor = FineCalculator.calculateDamageCharge(DamageCondition.MINOR_DAMAGE, price);
    expect(minor.charge).toBe(100);
    expect(minor.nextStatus).toBe('MAINTENANCE');

    // Major Damage: 50% of price, copy MAINTENANCE
    const major = FineCalculator.calculateDamageCharge(DamageCondition.MAJOR_DAMAGE, price);
    expect(major.charge).toBe(500);
    expect(major.nextStatus).toBe('MAINTENANCE');

    // Unusable: 100% of price + 200 THB fee, copy RETIRED
    const unusable = FineCalculator.calculateDamageCharge(DamageCondition.UNUSABLE, price);
    expect(unusable.charge).toBe(1200);
    expect(unusable.nextStatus).toBe('RETIRED');
  });
});
