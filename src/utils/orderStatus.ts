import { Brand } from '@/constants/theme';
import { OrderStatus } from '@/context/AppContext';

export const ORDER_STATUS_OPTIONS: OrderStatus[] = ['pending', 'on_progress', 'completed', 'refund'];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  on_progress: 'On Progress',
  completed: 'Completed',
  refund: 'Refund',
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  pending: Brand.gold,
  on_progress: Brand.skyBlue,
  completed: Brand.success,
  refund: Brand.danger,
};
