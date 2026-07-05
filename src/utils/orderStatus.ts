import { OrderStatus } from '@/context/AppContext';

export const ORDER_STATUS_OPTIONS: OrderStatus[] = ['pending', 'on_progress', 'completed', 'refund'];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  on_progress: 'On Progress',
  completed: 'Completed',
  refund: 'Refund',
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  pending: '#F5A623',
  on_progress: '#4A90D9',
  completed: '#34A853',
  refund: '#D93025',
};
