import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, HeadingFont } from '@/constants/theme';
import { MenuItem, useAppContext } from '@/context/AppContext';
import { formatRupiah } from '@/utils/formatRupiah';

type FormState = {
  id: string | null;
  name: string;
  price: string;
  imageUri: string | null;
};

const EMPTY_FORM: FormState = { id: null, name: '', price: '', imageUri: null };

export function MenuScreen() {
  const { menuItems, addMenuItem, updateMenuItem, deleteMenuItem } = useAppContext();
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const openAddForm = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setFormVisible(true);
  };

  const openEditForm = (item: MenuItem) => {
    setForm({ id: item.id, name: item.name, price: String(item.price), imageUri: item.imageUri });
    setError(null);
    setFormVisible(true);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Izin diperlukan', 'Aplikasi butuh izin akses galeri untuk memilih gambar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      setForm((prev) => ({ ...prev, imageUri: result.assets[0].uri }));
    }
  };

  const handleSave = () => {
    const trimmedName = form.name.trim();
    const price = Number(form.price);

    if (!trimmedName) {
      setError('Nama menu tidak boleh kosong.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError('Harga harus berupa angka lebih besar atau sama dengan 0.');
      return;
    }

    if (form.id) {
      updateMenuItem(form.id, { name: trimmedName, price, imageUri: form.imageUri });
    } else {
      addMenuItem({ name: trimmedName, price, imageUri: form.imageUri });
    }
    setFormVisible(false);
  };

  const handleDelete = (item: MenuItem) => {
    Alert.alert('Hapus Menu', `Hapus "${item.name}" dari menu?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => deleteMenuItem(item.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu Face Paint</Text>
        <Pressable style={styles.addButton} onPress={openAddForm}>
          <Text style={styles.addButtonText}>+ Tambah Menu</Text>
        </Pressable>
      </View>

      <FlatList
        data={menuItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Belum ada menu. Tambahkan menu pertama Anda.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.thumbnail} />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                <Text style={{ fontSize: 20 }}>🎨</Text>
              </View>
            )}
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowPrice}>{formatRupiah(item.price)}</Text>
            </View>
            <Pressable style={styles.iconButton} onPress={() => openEditForm(item)}>
              <Text style={styles.iconButtonText}>Edit</Text>
            </Pressable>
            <Pressable
              style={[styles.iconButton, styles.deleteButton]}
              onPress={() => handleDelete(item)}>
              <Text style={[styles.iconButtonText, styles.deleteButtonText]}>Hapus</Text>
            </Pressable>
          </View>
        )}
      />

      <Modal visible={formVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{form.id ? 'Edit Menu' : 'Tambah Menu'}</Text>

            <Pressable style={styles.imagePickerButton} onPress={pickImage}>
              {form.imageUri ? (
                <Image source={{ uri: form.imageUri }} style={styles.imagePickerPreview} />
              ) : (
                <Text style={styles.imagePickerText}>Pilih Gambar</Text>
              )}
            </Pressable>

            <TextInput
              style={styles.input}
              placeholder="Nama menu"
              placeholderTextColor={Brand.inkMuted}
              value={form.name}
              onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Harga"
              placeholderTextColor={Brand.inkMuted}
              keyboardType="numeric"
              value={form.price ? formatRupiah(Number(form.price)) : ''}
              onChangeText={(text) =>
                setForm((prev) => ({ ...prev, price: text.replace(/[^0-9]/g, '') }))
              }
            />

            {error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setFormVisible(false)}>
                <Text style={styles.modalButtonText}>Batal</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.saveButton]} onPress={handleSave}>
                <Text style={[styles.modalButtonText, styles.saveButtonText]}>Simpan</Text>
              </Pressable>
            </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: HeadingFont,
  },
  addButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: Brand.plum,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#ffffff',
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 12,
    backgroundColor: Brand.parchmentDark,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.parchmentSelected,
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontWeight: '600',
    fontSize: 15,
  },
  rowPrice: {
    color: Brand.inkMuted,
    fontSize: 13,
  },
  iconButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    color: Brand.plum,
    fontWeight: '600',
  },
  deleteButton: {},
  deleteButtonText: {
    color: Brand.danger,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
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
  imagePickerButton: {
    alignSelf: 'center',
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: Brand.parchmentDark,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagePickerPreview: {
    width: '100%',
    height: '100%',
  },
  imagePickerText: {
    color: Brand.inkMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: Brand.parchmentSelected,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  errorText: {
    color: Brand.danger,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: Brand.parchmentDark,
  },
  saveButton: {
    backgroundColor: Brand.plum,
  },
  modalButtonText: {
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#ffffff',
  },
});
