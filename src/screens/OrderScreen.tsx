import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CartRow } from '@/components/CartRow';
import { MenuItemButton } from '@/components/MenuItemButton';
import { WaitingListModal } from '@/components/WaitingListModal';
import { Brand, HeadingFont } from '@/constants/theme';
import { getOrderStatus, MenuItem, OrderAddOn, OrderItem, PaymentMethod, useAppContext } from '@/context/AppContext';
import { formatPhoneNumber } from '@/utils/contactLinks';
import { formatDateKey, getNextAvailableSlot, isSlotTaken } from '@/utils/timeSlots';
import { formatRupiah } from '@/utils/formatRupiah';
import { generateId } from '@/utils/id';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Tunai' },
  { value: 'qris', label: 'QRIS' },
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
  const [groupMemberNames, setGroupMemberNames] = useState<string[]>([]);
  const [addOns, setAddOns] = useState<OrderAddOn[]>([]);
  const [addOnNameInput, setAddOnNameInput] = useState('');
  const [addOnPriceInput, setAddOnPriceInput] = useState('');
  const [isCartExpanded, setIsCartExpanded] = useState(true);
  const [isWaitingListVisible, setIsWaitingListVisible] = useState(false);
  const [isCustomerModalVisible, setIsCustomerModalVisible] = useState(false);
  const [isAddOnModalVisible, setIsAddOnModalVisible] = useState(false);
  const [isPreOrder, setIsPreOrder] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date());
  const [scheduledTime, setScheduledTime] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const cartScrollRef = useRef<ScrollView>(null);
  const previousCartLengthRef = useRef(0);

  const pendingOrders = orders.filter((o) => getOrderStatus(o) === 'pending');

  const bookedTimesForDate = orders
    .filter(
      (o) =>
        o.id !== orderId &&
        o.scheduledDate === formatDateKey(scheduledDate) &&
        (getOrderStatus(o) === 'pending' || getOrderStatus(o) === 'on_progress') &&
        o.scheduledTime
    )
    .map((o) => o.scheduledTime as string)
    .sort();

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
          setGroupMemberNames(existing.groupMemberNames ?? []);
          setAddOns(existing.addOns ?? []);
          if (existing.scheduledDate) {
            setIsPreOrder(true);
            setScheduledDate(new Date(`${existing.scheduledDate}T00:00:00`)); // parse as local midnight, not UTC, to avoid a day-shift
            setScheduledTime(existing.scheduledTime);
          } else {
            setIsPreOrder(false);
            setScheduledDate(new Date());
            setScheduledTime(null);
          }
          previousCartLengthRef.current = existing.items.length;
          return;
        }
      }
      setCart([]);
      setPaymentMethod(null);
      setCustomerName('');
      setCustomerWhatsapp('');
      setCustomerInstagram('');
      setGroupMemberNames([]);
      setAddOns([]);
      setIsPreOrder(false);
      setScheduledDate(new Date());
      setScheduledTime(null);
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

  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const addOnsTotal = addOns.reduce((sum, addOn) => sum + addOn.price, 0);
  const total = cartSubtotal + addOnsTotal;

  const handleAddAddOn = () => {
    const trimmedName = addOnNameInput.trim();
    const price = Number(addOnPriceInput);
    if (!trimmedName) {
      Alert.alert('Nama add-on kosong', 'Isi nama add-on sebelum menambahkan.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      Alert.alert('Harga tidak valid', 'Harga add-on harus berupa angka lebih besar atau sama dengan 0.');
      return;
    }
    setAddOns((prev) => [...prev, { id: generateId(), name: trimmedName, price }]);
    setAddOnNameInput('');
    setAddOnPriceInput('');
  };

  const removeAddOn = (id: string) => {
    setAddOns((prev) => prev.filter((a) => a.id !== id));
  };

  const addGroupMember = () => setGroupMemberNames((prev) => [...prev, '']);
  const updateGroupMember = (index: number, name: string) =>
    setGroupMemberNames((prev) => prev.map((n, i) => (i === index ? name : n)));
  const removeGroupMember = (index: number) =>
    setGroupMemberNames((prev) => prev.filter((_, i) => i !== index));

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
    if (isPreOrder && !scheduledTime) {
      Alert.alert('Slot PO belum dipilih', 'Pilih tanggal dan jam slot PO sebelum menyimpan order.');
      return;
    }

    const patch = {
      customerName: trimmedName,
      customerWhatsapp: trimmedWhatsapp,
      customerInstagram: customerInstagram.trim(),
      items: cart,
      paymentMethod,
      totalHarga: total,
      scheduledDate: isPreOrder ? formatDateKey(scheduledDate) : null,
      scheduledTime: isPreOrder ? scheduledTime : null,
      groupMemberNames: groupMemberNames.map((n) => n.trim()).filter((n) => n.length > 0),
      addOns,
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
    setGroupMemberNames([]);
    setAddOns([]);
    setAddOnNameInput('');
    setAddOnPriceInput('');
    setIsPreOrder(false);
    setScheduledDate(new Date());
    setScheduledTime(null);
    router.push('/history');
  };

  const handleCancel = () => {
    setCart([]);
    setPaymentMethod(null);
    setCustomerName('');
    setCustomerWhatsapp('');
    setCustomerInstagram('');
    setGroupMemberNames([]);
    setAddOns([]);
    setAddOnNameInput('');
    setAddOnPriceInput('');
    setIsPreOrder(false);
    setScheduledDate(new Date());
    setScheduledTime(null);
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

      <Pressable style={styles.customerSummary} onPress={() => setIsCustomerModalVisible(true)}>
        <View style={styles.customerSummaryText}>
          <Text style={styles.customerSummaryLabel}>Info Pelanggan</Text>
          <Text style={styles.customerSummaryValue} numberOfLines={1}>
            {customerName || 'Tap untuk isi nama, kontak, & PO'}
          </Text>
        </View>
        {isPreOrder && (
          <View style={styles.customerSummaryBadge}>
            <Text style={styles.customerSummaryBadgeText}>
              PO {scheduledTime ?? '?'}
            </Text>
          </View>
        )}
      </Pressable>

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

      <Pressable style={styles.addOnSummary} onPress={() => setIsAddOnModalVisible(true)}>
        <View style={styles.addOnSummaryText}>
          <Text style={styles.customerSummaryLabel}>Add-on</Text>
          <Text style={styles.customerSummaryValue} numberOfLines={1}>
            {addOns.length > 0
              ? `${addOns.length} add-on · ${formatRupiah(addOnsTotal)}`
              : 'Tap untuk tambah add-on'}
          </Text>
        </View>
      </Pressable>

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

      <Modal
        visible={isCustomerModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsCustomerModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Info Pelanggan & PO</Text>

            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              <TextInput
                style={styles.input}
                placeholder="Nama Pelanggan"
                placeholderTextColor={Brand.inkMuted}
                value={customerName}
                onChangeText={setCustomerName}
              />
              <TextInput
                style={styles.input}
                placeholder="No. WhatsApp (opsional)"
                placeholderTextColor={Brand.inkMuted}
                keyboardType="phone-pad"
                value={formatPhoneNumber(customerWhatsapp)}
                onChangeText={(text) => setCustomerWhatsapp(text.replace(/\D/g, ''))}
              />
              <TextInput
                style={styles.input}
                placeholder="Nama Instagram (opsional)"
                placeholderTextColor={Brand.inkMuted}
                autoCapitalize="none"
                value={customerInstagram}
                onChangeText={setCustomerInstagram}
              />

              <View style={styles.groupSection}>
                <View style={styles.poToggleRow}>
                  <Text style={styles.poToggleLabel}>Order untuk grup?</Text>
                  <Switch
                    value={groupMemberNames.length > 0}
                    onValueChange={(value) => setGroupMemberNames(value ? [''] : [])}
                    trackColor={{ false: Brand.parchmentSelected, true: Brand.plum }}
                    thumbColor="#ffffff"
                  />
                </View>

                {groupMemberNames.length > 0 && (
                  <View style={styles.groupMembersList}>
                    {groupMemberNames.map((name, index) => (
                      <View key={index} style={styles.groupMemberRow}>
                        <TextInput
                          style={[styles.input, styles.groupMemberInput]}
                          placeholder={`Nama anggota ${index + 1}`}
                          placeholderTextColor={Brand.inkMuted}
                          value={name}
                          onChangeText={(text) => updateGroupMember(index, text)}
                        />
                        <Pressable style={styles.groupMemberRemove} onPress={() => removeGroupMember(index)}>
                          <Text style={styles.groupMemberRemoveText}>Hapus</Text>
                        </Pressable>
                      </View>
                    ))}
                    <Pressable style={styles.addGroupMemberButton} onPress={addGroupMember}>
                      <Text style={styles.addGroupMemberButtonText}>+ Tambah Anggota</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              <View style={styles.poSection}>
                <View style={styles.poToggleRow}>
                  <Text style={styles.poToggleLabel}>Jadwalkan sebagai PO?</Text>
                  <Switch
                    value={isPreOrder}
                    onValueChange={(value) => {
                      setIsPreOrder(value);
                      if (value) {
                        const today = new Date();
                        setScheduledDate(today);
                        setScheduledTime(getNextAvailableSlot(orders, formatDateKey(today), orderId));
                      }
                    }}
                    trackColor={{ false: Brand.parchmentSelected, true: Brand.plum }}
                    thumbColor="#ffffff"
                  />
                </View>

                {isPreOrder && (
                  <View style={styles.poDetails}>
                    <Pressable style={styles.dateTrigger} onPress={() => setShowDatePicker(true)}>
                      <Text style={styles.dateTriggerLabel}>Tanggal PO</Text>
                      <Text style={styles.dateTriggerValue}>
                        {scheduledDate.toLocaleDateString('id-ID', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </Text>
                    </Pressable>

                    {showDatePicker && (
                      <DateTimePicker
                        value={scheduledDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        minimumDate={new Date()}
                        onChange={(event, date) => {
                          setShowDatePicker(false);
                          if (event.type !== 'dismissed' && date) {
                            setScheduledDate(date);
                            setScheduledTime(getNextAvailableSlot(orders, formatDateKey(date), orderId));
                          }
                        }}
                      />
                    )}

                    <Text style={styles.poToggleLabel}>Jam PO</Text>
                    <Pressable style={styles.dateTrigger} onPress={() => setShowTimePicker(true)}>
                      <Text style={styles.dateTriggerLabel}>Jam</Text>
                      <Text style={styles.dateTriggerValue}>{scheduledTime ?? 'Belum dipilih'}</Text>
                    </Pressable>

                    {showTimePicker && (
                      <DateTimePicker
                        value={(() => {
                          const base = new Date(scheduledDate);
                          if (scheduledTime) {
                            const [hh, mm] = scheduledTime.split(':').map(Number);
                            base.setHours(hh, mm, 0, 0);
                          }
                          return base;
                        })()}
                        mode="time"
                        is24Hour
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, date) => {
                          setShowTimePicker(false);
                          if (event.type === 'dismissed' || !date) return;
                          const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(
                            date.getMinutes()
                          ).padStart(2, '0')}`;
                          if (isSlotTaken(orders, formatDateKey(scheduledDate), timeStr, orderId)) {
                            Alert.alert(
                              'Jam sudah dipakai',
                              `Sudah ada PO lain pada jam ${timeStr} di tanggal ini. Pilih jam lain.`
                            );
                            return;
                          }
                          setScheduledTime(timeStr);
                        }}
                      />
                    )}

                    <View style={styles.bookedTimesBox}>
                      <Text style={styles.bookedTimesLabel}>
                        Jam yang sudah dipesan di tanggal ini
                      </Text>
                      {bookedTimesForDate.length > 0 ? (
                        <View style={styles.bookedTimesRow}>
                          {bookedTimesForDate.map((time, index) => (
                            <View key={`${time}-${index}`} style={styles.bookedTimeChip}>
                              <Text style={styles.bookedTimeChipText}>{time}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.bookedTimesEmpty}>Belum ada PO di tanggal ini.</Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            <Pressable
              style={styles.modalDoneButton}
              onPress={() => setIsCustomerModalVisible(false)}>
              <Text style={styles.modalDoneButtonText}>Selesai</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={isAddOnModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAddOnModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add-on</Text>

            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              {addOns.map((addOn) => (
                <View key={addOn.id} style={styles.addOnRow}>
                  <Text style={styles.addOnName} numberOfLines={2}>{addOn.name}</Text>
                  <Text style={styles.addOnPrice}>{formatRupiah(addOn.price)}</Text>
                  <Pressable style={styles.addOnRemove} onPress={() => removeAddOn(addOn.id)}>
                    <Text style={styles.addOnRemoveText}>Hapus</Text>
                  </Pressable>
                </View>
              ))}

              <View style={styles.addOnForm}>
                <TextInput
                  style={[styles.input, styles.addOnFormNameInput]}
                  placeholder="Nama Add-on"
                  placeholderTextColor={Brand.inkMuted}
                  value={addOnNameInput}
                  onChangeText={setAddOnNameInput}
                />
                <View style={styles.addOnFormRow}>
                  <TextInput
                    style={[styles.input, styles.addOnFormPriceInput]}
                    placeholder="Harga"
                    placeholderTextColor={Brand.inkMuted}
                    keyboardType="numeric"
                    value={addOnPriceInput ? formatRupiah(Number(addOnPriceInput)) : ''}
                    onChangeText={(text) => setAddOnPriceInput(text.replace(/\D/g, ''))}
                  />
                  <Pressable style={styles.addOnAddButton} onPress={handleAddAddOn}>
                    <Text style={styles.addOnAddButtonText}>+ Tambah</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>

            <Pressable
              style={styles.modalDoneButton}
              onPress={() => setIsAddOnModalVisible(false)}>
              <Text style={styles.modalDoneButtonText}>Selesai</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.parchment,
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
    fontFamily: HeadingFont,
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
  customerSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Brand.parchmentSelected,
    backgroundColor: Brand.parchmentDark,
  },
  customerSummaryText: {
    flex: 1,
  },
  customerSummaryLabel: {
    fontSize: 11,
    color: Brand.inkMuted,
  },
  customerSummaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.ink,
  },
  customerSummaryBadge: {
    backgroundColor: Brand.gold,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  customerSummaryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '85%',
    backgroundColor: Brand.parchment,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: HeadingFont,
  },
  modalScrollContent: {
    gap: 12,
    paddingBottom: 8,
  },
  modalDoneButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: Brand.plum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDoneButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: Brand.parchmentSelected,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  poSection: {
    gap: 8,
  },
  poToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  poToggleLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.ink,
  },
  poDetails: {
    gap: 8,
  },
  dateTrigger: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: Brand.parchmentDark,
    paddingHorizontal: 12,
    gap: 2,
  },
  dateTriggerLabel: {
    fontSize: 11,
    color: Brand.inkMuted,
  },
  dateTriggerValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.ink,
  },
  bookedTimesBox: {
    gap: 6,
  },
  bookedTimesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.inkMuted,
  },
  bookedTimesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bookedTimeChip: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: Brand.parchmentSelected,
  },
  bookedTimeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.ink,
  },
  bookedTimesEmpty: {
    fontSize: 13,
    color: Brand.inkMuted,
    fontStyle: 'italic',
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
    color: Brand.inkMuted,
    marginTop: 16,
  },
  cartSection: {
    borderTopWidth: 1,
    borderTopColor: Brand.parchmentSelected,
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
    color: Brand.inkMuted,
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
    borderTopColor: Brand.parchmentSelected,
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
    backgroundColor: Brand.parchmentDark,
  },
  paymentButtonSelected: {
    backgroundColor: Brand.plum,
  },
  paymentButtonText: {
    fontWeight: '600',
    color: Brand.inkMuted,
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
    color: Brand.inkMuted,
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
    backgroundColor: Brand.parchmentDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: Brand.inkMuted,
    fontWeight: '700',
    fontSize: 16,
  },
  saveButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: Brand.plum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  groupSection: {
    gap: 8,
  },
  groupMembersList: {
    gap: 8,
  },
  groupMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupMemberInput: {
    flex: 1,
  },
  groupMemberRemove: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  groupMemberRemoveText: {
    color: Brand.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  addGroupMemberButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: Brand.parchmentDark,
  },
  addGroupMemberButtonText: {
    color: Brand.plum,
    fontWeight: '700',
    fontSize: 14,
  },
  addOnSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Brand.parchmentSelected,
    backgroundColor: Brand.parchmentDark,
  },
  addOnSummaryText: {
    flex: 1,
  },
  addOnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Brand.parchmentDark,
  },
  addOnName: {
    flex: 1,
    fontWeight: '600',
    fontSize: 14,
    color: Brand.ink,
  },
  addOnPrice: {
    fontSize: 13,
    color: Brand.inkMuted,
  },
  addOnRemove: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  addOnRemoveText: {
    color: Brand.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  addOnForm: {
    flexDirection: 'column',
    gap: 8,
  },
  addOnFormRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addOnFormNameInput: {},
  addOnFormPriceInput: {
    flex: 1,
  },
  addOnAddButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Brand.plum,
  },
  addOnAddButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
