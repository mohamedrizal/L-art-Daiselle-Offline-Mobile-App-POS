import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, HeadingFont } from '@/constants/theme';
import { getOrderStatus, useAppContext } from '@/context/AppContext';
import {
  getLastSyncedAt,
  isCloudSyncConfigured,
  restoreFromCloud,
  syncToCloud,
} from '@/utils/cloudSync';
import { createExcelFile } from '@/utils/excelExport';
import { presentFileSaveOptions } from '@/utils/fileActions';
import { formatRupiah } from '@/utils/formatRupiah';

function formatDateHeader(dateKey: string): string {
  return new Date(dateKey).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatSyncTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ReportScreen() {
  const { menuItems, orders, replaceAll } = useAppContext();
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoringCloud, setIsRestoringCloud] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const cloudConfigured = isCloudSyncConfigured();

  useEffect(() => {
    getLastSyncedAt().then(setLastSyncedAt);
  }, []);

  const completedOrders = orders.filter((order) => getOrderStatus(order) === 'completed');

  const groupsByDate = new Map<string, typeof orders>();
  for (const order of completedOrders) {
    const dateKey = order.createdAt.slice(0, 10);
    const group = groupsByDate.get(dateKey);
    if (group) {
      group.push(order);
    } else {
      groupsByDate.set(dateKey, [order]);
    }
  }
  const dailyBreakdown = Array.from(groupsByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, group]) => {
      const gross = group.reduce((sum, order) => sum + order.totalHarga, 0);
      return {
        dateKey,
        gross,
        committee: Math.round(gross * 0.15),
        profit: Math.round(gross * 0.85),
      };
    });

  const grossTotal = completedOrders.reduce((sum, order) => sum + order.totalHarga, 0);
  const committeeTotal = Math.round(grossTotal * 0.15);
  const profitTotal = Math.round(grossTotal * 0.85);

  const refundOrders = orders.filter((order) => getOrderStatus(order) === 'refund');
  const refundTotal = refundOrders.reduce((sum, order) => sum + order.totalHarga, 0);

  const handleExport = async () => {
    if (orders.length === 0) {
      Alert.alert('Belum ada data', 'Belum ada order untuk diekspor.');
      return;
    }
    setIsExporting(true);
    try {
      const file = await createExcelFile(orders);
      presentFileSaveOptions(file, {
        title: 'Export Excel',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    } catch {
      Alert.alert('Gagal export', 'Terjadi kesalahan saat membuat file Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSyncToCloud = async () => {
    if (!cloudConfigured) {
      Alert.alert('Supabase belum dikonfigurasi', 'Isi file .env terlebih dahulu untuk mengaktifkan sync ke cloud.');
      return;
    }
    setIsSyncing(true);
    try {
      const result = await syncToCloud({ menuItems, orders });
      if (result.ok) {
        setLastSyncedAt(await getLastSyncedAt());
        Alert.alert('Berhasil', result.message);
      } else {
        Alert.alert('Gagal sync', result.message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!cloudConfigured) {
      Alert.alert('Supabase belum dikonfigurasi', 'Isi file .env terlebih dahulu untuk mengaktifkan restore dari cloud.');
      return;
    }
    setIsRestoringCloud(true);
    try {
      const result = await restoreFromCloud();
      if (!result.ok) {
        Alert.alert('Gagal restore', result.message);
        return;
      }
      const { data } = result;
      Alert.alert(
        'Restore dari Cloud',
        `Data saat ini akan ditimpa dengan cadangan cloud ini (${data.menuItems.length} menu, ${data.orders.length} order). Lanjutkan?`,
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Timpa Data',
            style: 'destructive',
            onPress: async () => {
              replaceAll(data);
              setLastSyncedAt(await getLastSyncedAt());
            },
          },
        ]
      );
    } finally {
      setIsRestoringCloud(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Laporan</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Order Completed</Text>
          <Text style={styles.summaryValue}>{completedOrders.length}</Text>

          <View style={styles.divider} />

          <Text style={styles.summaryLabel}>Total Pendapatan Kotor (dari order Completed)</Text>
          <Text style={styles.summaryValueLarge}>{formatRupiah(grossTotal)}</Text>

          <View style={styles.splitRow}>
            <View style={styles.splitItem}>
              <Text style={styles.summaryLabel}>Bagian Panitia (15%)</Text>
              <Text style={styles.summaryValue}>{formatRupiah(committeeTotal)}</Text>
            </View>
            <View style={styles.splitItem}>
              <Text style={styles.summaryLabel}>Keuntungan Pribadi (85%)</Text>
              <Text style={styles.summaryValue}>{formatRupiah(profitTotal)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.refundCard}>
          <Text style={styles.summaryLabel}>Order Refund</Text>
          <View style={styles.splitRow}>
            <View style={styles.splitItem}>
              <Text style={styles.summaryLabel}>Jumlah Order</Text>
              <Text style={styles.summaryValue}>{refundOrders.length}</Text>
            </View>
            <View style={styles.splitItem}>
              <Text style={styles.summaryLabel}>Total Nominal</Text>
              <Text style={styles.summaryValue}>{formatRupiah(refundTotal)}</Text>
            </View>
          </View>
        </View>

        {dailyBreakdown.length > 0 && (
          <View style={styles.breakdownSection}>
            <Text style={styles.sectionTitle}>Rincian per Tanggal</Text>
            {dailyBreakdown.map((day) => (
              <View key={day.dateKey} style={styles.dayCard}>
                <Text style={styles.dayTitle}>{formatDateHeader(day.dateKey)}</Text>
                <View style={styles.dayRow}>
                  <Text style={styles.dayLabel}>Kotor</Text>
                  <Text style={styles.dayValue}>{formatRupiah(day.gross)}</Text>
                </View>
                <View style={styles.dayRow}>
                  <Text style={styles.dayLabel}>Panitia (15%)</Text>
                  <Text style={styles.dayValue}>{formatRupiah(day.committee)}</Text>
                </View>
                <View style={styles.dayRow}>
                  <Text style={styles.dayLabel}>Keuntungan (85%)</Text>
                  <Text style={styles.dayValue}>{formatRupiah(day.profit)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Pressable style={styles.exportButton} onPress={handleExport} disabled={isExporting}>
          <Text style={styles.exportButtonText}>
            {isExporting ? 'Membuat file...' : 'Export Excel'}
          </Text>
        </Pressable>

        <Text style={styles.syncStatus}>
          {cloudConfigured
            ? lastSyncedAt
              ? `Terakhir sync: ${formatSyncTimestamp(lastSyncedAt)}`
              : 'Belum pernah sync'
            : 'Supabase belum dikonfigurasi'}
        </Text>

        <View style={styles.backupRow}>
          <Pressable style={styles.secondaryButton} onPress={handleSyncToCloud} disabled={isSyncing}>
            <Text style={styles.secondaryButtonText}>
              {isSyncing ? 'Menyinkronkan...' : 'Sync ke Cloud'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={handleRestoreFromCloud}
            disabled={isRestoringCloud}>
            <Text style={styles.secondaryButtonText}>
              {isRestoringCloud ? 'Memuat...' : 'Restore dari Cloud'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.parchment,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: HeadingFont,
  },
  summaryCard: {
    backgroundColor: Brand.parchmentDark,
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  refundCard: {
    backgroundColor: '#FBE9E7',
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: Brand.inkMuted,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryValueLarge: {
    fontSize: 26,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: Brand.parchmentSelected,
    marginVertical: 8,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  splitItem: {
    flex: 1,
  },
  breakdownSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  dayCard: {
    backgroundColor: Brand.parchmentDark,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  dayTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayLabel: {
    color: Brand.inkMuted,
    fontSize: 13,
  },
  dayValue: {
    fontWeight: '600',
    fontSize: 13,
  },
  exportButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: Brand.plum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  syncStatus: {
    fontSize: 12,
    color: Brand.inkMuted,
    textAlign: 'center',
  },
  backupRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: Brand.parchmentDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Brand.plum,
    fontWeight: '700',
  },
});
