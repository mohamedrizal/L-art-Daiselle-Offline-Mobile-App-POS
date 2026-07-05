import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MenuItem } from '@/context/AppContext';
import { formatRupiah } from '@/utils/formatRupiah';

type Props = {
  item: MenuItem;
  onPress: (item: MenuItem) => void;
};

export function MenuItemButton({ item, onPress }: Props) {
  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}>
      {item.imageUri ? (
        <Image source={{ uri: item.imageUri }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderText}>🎨</Text>
        </View>
      )}
      <Text style={styles.name} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={styles.price}>{formatRupiah(item.price)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '31%',
    minHeight: 120,
    borderRadius: 12,
    backgroundColor: '#F0F0F3',
    padding: 8,
    alignItems: 'center',
    gap: 4,
  },
  pressed: {
    opacity: 0.6,
  },
  image: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0E1E6',
  },
  imagePlaceholderText: {
    fontSize: 24,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  price: {
    fontSize: 12,
    color: '#60646C',
  },
});
