import * as FileSystem from 'expo-file-system/legacy';

const IMAGES_DIR = 'images';

function getImagesDir(): string {
  const docDir = FileSystem.documentDirectory;
  if (!docDir) throw new Error('Document directory not available');
  return `${docDir}${IMAGES_DIR}/`;
}

function ensureImagesDir(): string {
  const dir = getImagesDir();
  return dir;
}

function generateImageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Copy image from URI (e.g. from image picker) to app document directory.
 * Returns the stored file path (URI) for DB storage.
 */
export async function saveImageFromUri(uri: string): Promise<string> {
  const dir = ensureImagesDir();
  const ext = uri.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const filename = `${generateImageId()}.${ext}`;
  const destUri = `${dir}${filename}`;

  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    // Directory may already exist
  }

  await FileSystem.copyAsync({ from: uri, to: destUri });
  return destUri;
}

/**
 * Replace image at oldPath with new image from newUri.
 * Deletes old file and saves new one. Returns new path.
 */
export async function updateImage(oldPath: string, newUri: string): Promise<string> {
  const newPath = await saveImageFromUri(newUri);
  await deleteImage(oldPath);
  return newPath;
}

/**
 * Delete image file at path.
 */
export async function deleteImage(path: string): Promise<void> {
  if (!path) return;
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      await FileSystem.deleteAsync(path);
    }
  } catch {
    // Ignore delete errors (file may already be gone)
  }
}

/**
 * Get display URI for Image component.
 * Only device paths are supported (file://, content://, or app document path).
 * Returns null for URLs – images must come from the user's device.
 */
export function getImageUri(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return null;
  if (path.startsWith('file://') || path.startsWith('content://')) return path;
  return `file://${path}`;
}
