import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OrderItem } from '@/context/AppContext';
import { formatRupiah } from '@/utils/formatRupiah';

type Props = {
  item: OrderItem;
  onIncrease: (menuItemId: string) => void;
  onDecrease: (menuItemId: string) => void;
  onRemove: (menuItemId: string) => void;
};

export function CartRow({ item, onIncrease, onDecrease, onRemove }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.price}>{formatRupiah(item.price)}</Text>
        <Pressable style={styles.removeButton} onPress={() => onRemove(item.menuItemId)}>
          <Text style={styles.removeButtonText}>Hapus</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Text style={styles.qtyLabel}>Qty</Text>
        <View style={styles.stepper}>
          <Pressable style={styles.stepButton} onPress={() => onDecrease(item.menuItemId)}>
            <Text style={styles.stepButtonText}>−</Text>
          </Pressable>
          <Text style={styles.qty}>{item.qty}</Text>
          <Pressable style={styles.stepButton} onPress={() => onIncrease(item.menuItemId)}>
            <Text style={styles.stepButtonText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.subtotalLabel}>Subtotal</Text>
        <Text style={styles.subtotal}>{formatRupiah(item.price * item.qty)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F0F0F3',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    flex: 1,
    fontWeight: '600',
    fontSize: 14,
  },
  price: {
    fontSize: 13,
    color: '#60646C',
  },
  removeButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  removeButtonText: {
    color: '#D93025',
    fontWeight: '600',
    fontSize: 13,
  },
  qtyLabel: {
    fontSize: 12,
    color: '#60646C',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0E1E6',
    borderRadius: 8,
  },
  stepButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  qty: {
    minWidth: 32,
    textAlign: 'center',
    fontWeight: '600',
  },
  subtotalLabel: {
    fontSize: 12,
    color: '#60646C',
  },
  subtotal: {
    fontWeight: '700',
    fontSize: 14,
  },
});
