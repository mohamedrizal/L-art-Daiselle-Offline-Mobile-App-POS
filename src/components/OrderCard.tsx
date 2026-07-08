import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { getOrderStatus, Order, OrderStatus, PaymentMethod } from '@/context/AppContext';
import { formatPhoneNumber } from '@/utils/contactLinks';
import { formatRupiah } from '@/utils/formatRupiah';
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, ORDER_STATUS_OPTIONS } from '@/utils/orderStatus';

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
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
  const allNames = [order.customerName, ...(order.groupMemberNames ?? [])];
  const namesLabel = allNames.join(', ');
  const customerLine = order.customerWhatsapp
    ? `${namesLabel} · ${formatPhoneNumber(order.customerWhatsapp)}`
    : namesLabel;

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

      <Text style={styles.customer} numberOfLines={2}>
        {customerLine}
      </Text>

      {order.scheduledDate && order.scheduledTime && (
        <Text style={styles.scheduleLabel}>
          PO: {new Date(`${order.scheduledDate}T00:00:00`).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })} · {order.scheduledTime}
        </Text>
      )}

      {order.addOns && order.addOns.length > 0 && (
        <Text style={styles.addOnLine} numberOfLines={2}>
          Add-on: {order.addOns.map((a) => a.name).join(', ')}
        </Text>
      )}

      <Text style={styles.items} numberOfLines={3}>
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
    backgroundColor: Brand.parchmentDark,
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
    backgroundColor: Brand.parchmentSelected,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Brand.inkMuted,
  },
  badgeTextLight: {
    color: '#ffffff',
  },
  customer: {
    fontSize: 13,
    fontWeight: '600',
  },
  scheduleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.gold,
  },
  addOnLine: {
    fontSize: 12,
    color: Brand.inkMuted,
    fontStyle: 'italic',
  },
  items: {
    fontSize: 13,
    color: Brand.inkMuted,
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
    color: Brand.plum,
    fontWeight: '600',
  },
  deleteText: {
    color: Brand.danger,
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
    backgroundColor: Brand.parchmentSelected,
    paddingHorizontal: 8,
  },
  statusChipActive: {
    backgroundColor: Brand.plum,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.inkMuted,
  },
  statusChipTextActive: {
    color: '#ffffff',
  },
});
