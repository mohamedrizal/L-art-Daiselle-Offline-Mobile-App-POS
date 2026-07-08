import { Alert, Linking, Modal, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { Brand, HeadingFont } from '@/constants/theme';
import { Order } from '@/context/AppContext';
import { toInstagramDmUrl, toWhatsappUrl } from '@/utils/contactLinks';
import { formatRupiah } from '@/utils/formatRupiah';

type Props = {
  visible: boolean;
  orders: Order[];
  onClose: () => void;
};

function openLink(url: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert('Gagal membuka', 'Tidak ada aplikasi yang bisa membuka tautan ini.');
  });
}

export function WaitingListModal({ visible, orders, onClose }: Props) {
  const poOrders = [...orders]
    .filter((o) => o.scheduledDate && o.scheduledTime)
    .sort((a, b) => `${a.scheduledDate} ${a.scheduledTime}`.localeCompare(`${b.scheduledDate} ${b.scheduledTime}`));

  const walkInOrders = [...orders]
    .filter((o) => !o.scheduledDate || !o.scheduledTime)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const sections = [
    ...(poOrders.length > 0 ? [{ title: 'Terjadwal (PO)', data: poOrders }] : []),
    ...(walkInOrders.length > 0 ? [{ title: 'Walk-in', data: walkInOrders }] : []),
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Waiting List ({orders.length})</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Tutup</Text>
            </Pressable>
          </View>

          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Tidak ada antrian pending saat ini.</Text>
            }
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionHeader}>{section.title}</Text>
            )}
            renderItem={({ item, index, section }) => {
              const isPO = !!(item.scheduledDate && item.scheduledTime);
              const scheduleLabel = isPO
                ? `${new Date(`${item.scheduledDate}T00:00:00`).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })} · ${item.scheduledTime}`
                : new Date(item.createdAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
              const itemsSummary = item.items.map((i) => `${i.name} x${i.qty}`).join(', ');

              return (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.queueNumber}>
                      {section.title === 'Terjadwal (PO)' ? `PO #${index + 1}` : `Walk-in #${index + 1}`}
                    </Text>
                    <Text style={styles.time}>{scheduleLabel}</Text>
                  </View>
                  <Text style={styles.customerName} numberOfLines={2}>
                    {[item.customerName, ...(item.groupMemberNames ?? [])].join(', ')}
                  </Text>
                  {item.addOns && item.addOns.length > 0 && (
                    <Text style={styles.addOnLine} numberOfLines={2}>
                      Add-on: {item.addOns.map((a) => a.name).join(', ')}
                    </Text>
                  )}
                  <Text style={styles.items} numberOfLines={3}>
                    {itemsSummary}
                  </Text>
                  <Text style={styles.total}>{formatRupiah(item.totalHarga)}</Text>

                  <View style={styles.contactRow}>
                    {!!item.customerWhatsapp && (
                      <Pressable
                        style={[styles.contactButton, styles.whatsappButton]}
                        onPress={() => openLink(toWhatsappUrl(item.customerWhatsapp))}>
                        <Text style={styles.contactButtonText}>Chat WA</Text>
                      </Pressable>
                    )}
                    {!!item.customerInstagram && (
                      <Pressable
                        style={[styles.contactButton, styles.instagramButton]}
                        onPress={() => openLink(toInstagramDmUrl(item.customerInstagram))}>
                        <Text style={styles.contactButtonText}>DM Instagram</Text>
                      </Pressable>
                    )}
                    {!item.customerWhatsapp && !item.customerInstagram && (
                      <Text style={styles.noContactText}>Tidak ada kontak WA/IG</Text>
                    )}
                  </View>
                </View>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Brand.parchment,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: HeadingFont,
  },
  closeButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: Brand.plum,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: Brand.inkMuted,
    marginTop: 32,
  },
  sectionHeader: {
    fontWeight: '700',
    fontSize: 14,
    color: Brand.plum,
    marginTop: 12,
    marginBottom: 4,
  },
  card: {
    backgroundColor: Brand.parchmentDark,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  queueNumber: {
    fontWeight: '700',
    color: Brand.gold,
  },
  time: {
    color: Brand.inkMuted,
  },
  customerName: {
    fontWeight: '700',
    fontSize: 15,
  },
  items: {
    fontSize: 13,
    color: Brand.inkMuted,
  },
  addOnLine: {
    fontSize: 13,
    color: Brand.inkMuted,
    fontStyle: 'italic',
  },
  total: {
    fontWeight: '700',
    fontSize: 15,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  contactButton: {
    minHeight: 44,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  instagramButton: {
    backgroundColor: '#C13584',
  },
  contactButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  noContactText: {
    color: Brand.inkMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
});
