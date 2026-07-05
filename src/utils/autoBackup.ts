import { Directory, File, Paths } from 'expo-file-system';

const AUTO_BACKUP_DIR_NAME = 'auto-backups';
const MAX_SNAPSHOTS = 5;

type AutoBackupData = { menuItems: unknown[]; orders: unknown[] };

function getAutoBackupDirectory(): Directory {
  const dir = new Directory(Paths.document, AUTO_BACKUP_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export async function writeAutoBackupSnapshot(data: AutoBackupData): Promise<void> {
  const dir = getAutoBackupDirectory();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = new File(dir, `snapshot-${timestamp}.json`);
  file.create({ overwrite: true });
  file.write(JSON.stringify(data));

  const snapshots = dir
    .list()
    .filter((entry): entry is File => entry instanceof File && entry.name.startsWith('snapshot-'))
    .sort((a, b) => (a.name < b.name ? 1 : -1));

  for (const old of snapshots.slice(MAX_SNAPSHOTS)) {
    old.delete();
  }
}
