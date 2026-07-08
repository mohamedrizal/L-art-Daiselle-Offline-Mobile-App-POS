import { Order, getOrderStatus } from '@/context/AppContext';

export const SLOT_INTERVAL_MINUTES = 30;
export const OPERATING_HOURS = { startHour: 9, endHour: 17 }; // 09:00 to 16:30 last slot (17:00 is the closing boundary, not bookable as a start time)

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Returns slots like ['09:00', '09:30', ..., '16:30'] */
export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  const startMinutes = OPERATING_HOURS.startHour * 60;
  const endMinutes = OPERATING_HOURS.endHour * 60;

  for (let m = startMinutes; m < endMinutes; m += SLOT_INTERVAL_MINUTES) {
    const hour = Math.floor(m / 60);
    const minute = m % 60;
    slots.push(`${pad2(hour)}:${pad2(minute)}`);
  }

  return slots;
}

/** Formats a Date as 'YYYY-MM-DD' in local time (not UTC) */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * True if some OTHER order (id !== excludeOrderId) already occupies this exact date+time slot
 * and is still "active" (status 'pending' or 'on_progress' — completed/refund orders free up the slot).
 */
export function isSlotTaken(
  orders: Order[],
  date: string,
  time: string,
  excludeOrderId?: string
): boolean {
  return (
    orders.filter((o) => {
      if (o.id === excludeOrderId) return false;
      if (o.scheduledDate !== date || o.scheduledTime !== time) return false;
      const status = getOrderStatus(o);
      return status === 'pending' || status === 'on_progress';
    }).length > 0
  );
}

/**
 * Returns the first available slot for the given date, skipping already-taken slots.
 * If `date` is today's date-key, also skips slots whose start time has already passed
 * (compare against the current wall-clock time). Returns null if nothing is available.
 */
export function getNextAvailableSlot(
  orders: Order[],
  date: string,
  excludeOrderId?: string
): string | null {
  const slots = generateTimeSlots();
  const now = new Date();
  const isToday = date === formatDateKey(now);
  const currentTimeKey = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

  for (const slot of slots) {
    if (isSlotTaken(orders, date, slot, excludeOrderId)) continue;
    if (isToday && slot <= currentTimeKey) continue;
    return slot;
  }

  return null;
}
