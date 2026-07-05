import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getOrderStatus, Order, OrderStatus, PaymentMethod } from '@/context/AppContext';
import { formatRupiah } from '@/utils/formatRupiah';
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, ORDER_STATUS_OPTIONS } from '@/utils/orderStatus';

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
};

type Props = {
  order: Order;
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
  onStatusChange: (order: Order, status: OrderStatus) => void;
};

export function OrderCard({ order, onEdit, onDelete, onStatusChange }: Props) {
  const time = new Date(order.createdAt).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const itemsSummary = order.items.map((item) => `${item.name} x${item.qty}`).join(', ');
  const status = getOrderStatus(order);
  const customerLine = order.customerWhatsapp
    ? `${order.customerName} · ${order.customerWhatsapp}`
    : order.customerName;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.time}>{time}</Text>
        <View style={styles.badgeGroup}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{PAYMENT_LABEL[order.paymentMethod]}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: ORDER_STATUS_COLOR[status] }]}>
            <Text style={[styles.badgeText, styles.badgeTextLight]}>
              {ORDER_STATUS_LABEL[status]}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.customer} numberOfLines={1}>
        {customerLine}
      </Text>

      <Text style={styles.items} numberOfLines={2}>
        {itemsSummary}
      </Text>

      <View style={styles.footerRow}>
        <Text style={styles.total}>{formatRupiah(order.totalHarga)}</Text>
        <View style={styles.actions}>
          <Pressable style={styles.actionButton} onPress={() => onEdit(order)}>
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => onDelete(order)}>
            <Text style={[styles.actionText, styles.deleteText]}>Hapus</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statusRow}>
        {ORDER_STATUS_OPTIONS.map((option) => (
          <Pressable
            key={option}
            style={[styles.statusChip, status === option && styles.statusChipActive]}
            onPress={() => onStatusChange(order, option)}>
            <Text
              style={[
                styles.statusChipText,
                status === option && styles.statusChipTextActive,
              ]}>
              {ORDER_STATUS_LABEL[option]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0F0F3',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: {
    fontWeight: '600',
    fontSize: 14,
  },
  badgeGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    backgroundColor: '#E0E1E6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#60646C',
  },
  badgeTextLight: {
    color: '#ffffff',
  },
  customer: {
    fontSize: 13,
    fontWeight: '600',
  },
  items: {
    fontSize: 13,
    color: '#60646C',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  total: {
    fontWeight: '700',
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  actionText: {
    color: '#208AEF',
    fontWeight: '600',
  },
  deleteText: {
    color: '#D93025',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    minHeight: 40,
    minWidth: '47%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#E0E1E6',
    paddingHorizontal: 8,
  },
  statusChipActive: {
    backgroundColor: '#208AEF',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#60646C',
  },
  statusChipTextActive: {
    color: '#ffffff',
  },
});
