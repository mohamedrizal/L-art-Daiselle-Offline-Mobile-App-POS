import { File, Paths } from 'expo-file-system';

import { AppData } from '@/context/AppContext';

export async function createBackupFile(data: AppData): Promise<File> {
  const file = new File(Paths.cache, `Cadangan-LartDaiselle-${Date.now()}.json`);
  file.create({ overwrite: true });
  file.write(JSON.stringify(data, null, 2));

  return file;
}

export async function importBackup(fileUri: string): Promise<AppData> {
  const file = new File(fileUri);
  const text = await file.text();
  const parsed = JSON.parse(text);

  if (!Array.isArray(parsed?.menuItems) || !Array.isArray(parsed?.orders)) {
    throw new Error('File cadangan tidak valid: menuItems atau orders tidak ditemukan.');
  }

  return { menuItems: parsed.menuItems, orders: parsed.orders };
}
