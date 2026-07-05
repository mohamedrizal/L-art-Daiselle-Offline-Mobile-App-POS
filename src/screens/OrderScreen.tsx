import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CartRow } from '@/components/CartRow';
import { MenuItemButton } from '@/components/MenuItemButton';
import { WaitingListModal } from '@/components/WaitingListModal';
import { getOrderStatus, MenuItem, OrderItem, PaymentMethod, useAppContext } from '@/context/AppContext';
import { formatRupiah } from '@/utils/formatRupiah';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Tunai' },
  { value: 'qris', label: 'QRIS' },
  { value: 'transfer', label: 'Transfer' },
];

export function OrderScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const router = useRouter();
  const { menuItems, orders, addOrder, updateOrder } = useAppContext();

  const [cart, setCart] = useState<OrderItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [customerInstagram, setCustomerInstagram] = useState('');
  const [isCartExpanded, setIsCartExpanded] = useState(true);
  const [isWaitingListVisible, setIsWaitingListVisible] = useState(false);
  const cartScrollRef = useRef<ScrollView>(null);
  const previousCartLengthRef = useRef(0);

  const pendingOrders = orders.filter((o) => getOrderStatus(o) === 'pending');

  useFocusEffect(
    useCallback(() => {
      setIsCartExpanded(true);
      if (orderId) {
        const existing = orders.find((o) => o.id === orderId);
        if (existing) {
          setCart(existing.items);
          setPaymentMethod(existing.paymentMethod);
          setCustomerName(existing.customerName);
          setCustomerWhatsapp(existing.customerWhatsapp);
          setCustomerInstagram(existing.customerInstagram);
          previousCartLengthRef.current = existing.items.length;
          return;
        }
      }
      setCart([]);
      setPaymentMethod(null);
      setCustomerName('');
      setCustomerWhatsapp('');
      setCustomerInstagram('');
      previousCartLengthRef.current = 0;
    }, [orderId, orders])
  );

  const addToCart = (menuItem: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === menuItem.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === menuItem.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { menuItemId: menuItem.id, name: menuItem.name, price: menuItem.price, qty: 1 }];
    });
  };

  const increaseQty = (menuItemId: string) => {
    setCart((prev) => prev.map((i) => (i.menuItemId === menuItemId ? { ...i, qty: i.qty + 1 } : i)));
  };

  const decreaseQty = (menuItemId: string) => {
    setCart((prev) =>
      prev
        .map((i) => (i.menuItemId === menuItemId ? { ...i, qty: i.qty - 1 } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const removeItem = (menuItemId: string) => {
    setCart((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
  };

  useEffect(() => {
    if (isCartExpanded && cart.length > previousCartLengthRef.current) {
      cartScrollRef.current?.scrollToEnd({ animated: true });
    }
    previousCartLengthRef.current = cart.length;
  }, [cart, isCartExpanded]);

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const handleSave = () => {
    const trimmedName = customerName.trim();
    const trimmedWhatsapp = customerWhatsapp.trim();

    if (!trimmedName) {
      Alert.alert('Nama pelanggan kosong', 'Isi nama pelanggan sebelum menyimpan order.');
      return;
    }
    if (cart.length === 0) {
      Alert.alert('Keranjang kosong', 'Tambahkan minimal satu item sebelum menyimpan order.');
      return;
    }
    if (!paymentMethod) {
      Alert.alert('Metode pembayaran', 'Pilih metode pembayaran sebelum menyimpan order.');
      return;
    }

    const patch = {
      customerName: trimmedName,
      customerWhatsapp: trimmedWhatsapp,
      customerInstagram: customerInstagram.trim(),
      items: cart,
      paymentMethod,
      totalHarga: total,
    };

    if (orderId) {
      updateOrder(orderId, patch);
    } else {
      addOrder(patch);
    }

    setCart([]);
    setPaymentMethod(null);
    setCustomerName('');
    setCustomerWhatsapp('');
    setCustomerInstagram('');
    router.push('/history');
  };

  const handleCancel = () => {
    setCart([]);
    setPaymentMethod(null);
    setCustomerName('');
    setCustomerWhatsapp('');
    setCustomerInstagram('');
    router.push('/history');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{orderId ? 'Edit Order' : 'Order Baru'}</Text>
        {pendingOrders.length > 0 && (
          <Pressable style={styles.pendingBadge} onPress={() => setIsWaitingListVisible(true)}>
            <Text style={styles.pendingBadgeText}>{pendingOrders.length} pending</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.customerSection}>
        <TextInput
          style={styles.input}
          placeholder="Nama Pelanggan"
          value={customerName}
          onChangeText={setCustomerName}
        />
        <TextInput
          style={styles.input}
          placeholder="No. WhatsApp (opsional)"
          keyboardType="phone-pad"
          value={customerWhatsapp}
          onChangeText={setCustomerWhatsapp}
        />
        <TextInput
          style={styles.input}
          placeholder="Nama Instagram (opsional)"
          autoCapitalize="none"
          value={customerInstagram}
          onChangeText={setCustomerInstagram}
        />
      </View>

      <FlatList
        data={menuItems}
        keyExtractor={(item) => item.id}
        numColumns={3}
        style={styles.grid}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Belum ada menu. Tambahkan menu di tab Menu.</Text>
        }
        renderItem={({ item }) => <MenuItemButton item={item} onPress={addToCart} />}
      />

      {cart.length > 0 && (
        <View style={styles.cartSection}>
          <Pressable
            style={styles.cartHeader}
            onPress={() => setIsCartExpanded((prev) => !prev)}>
            <Text style={styles.cartHeaderText}>Keranjang ({cart.length} item)</Text>
            <Text style={styles.cartHeaderChevron}>{isCartExpanded ? '▾' : '▸'}</Text>
          </Pressable>

          {isCartExpanded && (
            <ScrollView
              ref={cartScrollRef}
              style={styles.cartList}
              contentContainerStyle={styles.cartContent}>
              {cart.map((item) => (
                <CartRow
                  key={item.menuItemId}
                  item={item}
                  onIncrease={increaseQty}
                  onDecrease={decreaseQty}
                  onRemove={removeItem}
                />
              ))}
            </ScrollView>
          )}
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.paymentRow}>
          {PAYMENT_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={[
                styles.paymentButton,
                paymentMethod === option.value && styles.paymentButtonSelected,
              ]}
              onPress={() => setPaymentMethod(option.value)}>
              <Text
                style={[
                  styles.paymentButtonText,
                  paymentMethod === option.value && styles.paymentButtonTextSelected,
                ]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatRupiah(total)}</Text>
        </View>

        <View style={styles.actionRow}>
          {orderId && (
            <Pressable style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Batal</Text>
            </Pressable>
          )}
          <Pressable style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Simpan Order</Text>
          </Pressable>
        </View>
      </View>

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
    backgroundColor: '#ffffff',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  pendingBadge: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: '#FDECD2',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B36B00',
  },
  customerSection: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#E0E1E6',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  grid: {
    flex: 1,
  },
  gridRow: {
    gap: 8,
    paddingHorizontal: 16,
  },
  gridContent: {
    gap: 8,
    paddingBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#60646C',
    marginTop: 16,
  },
  cartSection: {
    borderTopWidth: 1,
    borderTopColor: '#E0E1E6',
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  cartHeaderText: {
    fontWeight: '700',
    fontSize: 14,
  },
  cartHeaderChevron: {
    fontSize: 16,
    color: '#60646C',
  },
  cartList: {
    maxHeight: 220,
  },
  cartContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#E0E1E6',
    padding: 16,
    gap: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#F0F0F3',
  },
  paymentButtonSelected: {
    backgroundColor: '#208AEF',
  },
  paymentButtonText: {
    fontWeight: '600',
    color: '#60646C',
  },
  paymentButtonTextSelected: {
    color: '#ffffff',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 15,
    color: '#60646C',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#F0F0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#60646C',
    fontWeight: '700',
    fontSize: 16,
  },
  saveButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});
