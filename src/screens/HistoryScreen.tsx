import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OrderCard } from '@/components/OrderCard';
import { WaitingListModal } from '@/components/WaitingListModal';
import { Brand, HeadingFont } from '@/constants/theme';
import { getOrderStatus, Order, OrderStatus, useAppContext } from '@/context/AppContext';
import { ORDER_STATUS_LABEL, ORDER_STATUS_OPTIONS } from '@/utils/orderStatus';

type StatusFilter = 'all' | OrderStatus;

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  ...ORDER_STATUS_OPTIONS.map((status) => ({ value: status, label: ORDER_STATUS_LABEL[status] })),
];

function formatDateHeader(dateKey: string): string {
  const date = new Date(dateKey);
  return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function HistoryScreen() {
  const { orders, deleteOrder, updateOrder } = useAppContext();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isWaitingListVisible, setIsWaitingListVisible] = useState(false);

  const pendingOrders = orders.filter((o) => getOrderStatus(o) === 'pending');
  const completedCount = orders.filter((o) => getOrderStatus(o) === 'completed').length;

  const filteredOrders =
    statusFilter === 'all' ? orders : orders.filter((o) => getOrderStatus(o) === statusFilter);

  const sortedOrders = [...filteredOrders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const groups = new Map<string, Order[]>();
  for (const order of sortedOrders) {
    const dateKey = order.createdAt.slice(0, 10);
    const group = groups.get(dateKey);
    if (group) {
      group.push(order);
    } else {
      groups.set(dateKey, [order]);
    }
  }
  const sections = Array.from(groups.entries()).map(([dateKey, data]) => ({
    title: formatDateHeader(dateKey),
    data,
  }));

  const handleEdit = (order: Order) => {
    router.push({ pathname: '/', params: { orderId: order.id } });
  };

  const handleDelete = (order: Order) => {
    Alert.alert('Hapus Order', 'Order ini akan dihapus permanen. Lanjutkan?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => deleteOrder(order.id) },
    ]);
  };

  const handleStatusChange = (order: Order, status: OrderStatus) => {
    updateOrder(order.id, { status });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Text style={styles.title}>Riwayat Order</Text>

      <View style={styles.summaryRow}>
        <Pressable style={styles.summaryCard} onPress={() => setIsWaitingListVisible(true)}>
          <Text style={styles.summaryLabel}>Pending</Text>
          <Text style={styles.summaryValue}>{pendingOrders.length}</Text>
        </Pressable>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Completed</Text>
          <Text style={styles.summaryValue}>{completedCount}</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.filterChip, statusFilter === option.value && styles.filterChipActive]}
            onPress={() => setStatusFilter(option.value)}>
            <Text
              style={[
                styles.filterChipText,
                statusFilter === option.value && styles.filterChipTextActive,
              ]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={<Text style={styles.emptyText}>Belum ada order untuk filter ini.</Text>}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <OrderCard
              order={item}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          </View>
        )}
      />

      <WaitingListModal
        visible={isWaitingListVisible}
        orders={pendingOrders}
        onClose={() => setIsWaitingListVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.parchment,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    fontFamily: HeadingFont,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Brand.parchmentDark,
    borderRadius: 12,
    padding: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: Brand.inkMuted,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterChip: {
    height: 44,
    alignSelf: 'flex-start',
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: Brand.parchmentDark,
  },
  filterChipActive: {
    backgroundColor: Brand.plum,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.inkMuted,
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: Brand.inkMuted,
    marginTop: 32,
  },
  sectionHeader: {
    fontWeight: '700',
    fontSize: 14,
    color: Brand.inkMuted,
    marginTop: 16,
    marginBottom: 8,
  },
  cardWrapper: {
    marginBottom: 8,
  },
});
