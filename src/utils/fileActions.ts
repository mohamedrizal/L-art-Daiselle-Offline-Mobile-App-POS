import { Directory, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

type FileActionOptions = {
  title: string;
  mimeType: string;
};

async function saveToDevice(file: File): Promise<void> {
  try {
    const destination = await Directory.pickDirectoryAsync();
    await file.copy(destination);
    Alert.alert('Berhasil', 'File berhasil disimpan ke perangkat.');
  } catch {
    // User cancelled the folder picker or the platform declined access; nothing to report.
  }
}

async function shareFile(file: File, mimeType: string, dialogTitle: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
  }
}

export function presentFileSaveOptions(file: File, options: FileActionOptions): void {
  Alert.alert(options.title, 'Simpan file ini ke perangkat atau bagikan?', [
    { text: 'Simpan ke Perangkat', onPress: () => saveToDevice(file) },
    { text: 'Bagikan', onPress: () => shareFile(file, options.mimeType, options.title) },
    { text: 'Batal', style: 'cancel' },
  ]);
}
