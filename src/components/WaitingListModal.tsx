import { Alert, FlatList, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

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
  const sorted = [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Waiting List ({sorted.length})</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Tutup</Text>
            </Pressable>
          </View>

          <FlatList
            data={sorted}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Tidak ada antrian pending saat ini.</Text>
            }
            renderItem={({ item, index }) => {
              const time = new Date(item.createdAt).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const itemsSummary = item.items.map((i) => `${i.name} x${i.qty}`).join(', ');

              return (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.queueNumber}>Antrian #{index + 1}</Text>
                    <Text style={styles.time}>{time}</Text>
                  </View>
                  <Text style={styles.customerName}>{item.customerName}</Text>
                  <Text style={styles.items} numberOfLines={2}>
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
    backgroundColor: '#ffffff',
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
  },
  closeButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#208AEF',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#60646C',
    marginTop: 32,
  },
  card: {
    backgroundColor: '#F0F0F3',
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
    color: '#F5A623',
  },
  time: {
    color: '#60646C',
  },
  customerName: {
    fontWeight: '700',
    fontSize: 15,
  },
  items: {
    fontSize: 13,
    color: '#60646C',
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
    color: '#60646C',
    fontSize: 13,
    fontStyle: 'italic',
  },
});
