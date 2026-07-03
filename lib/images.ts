import * as FileSystem from 'expo-file-system/legacy';

export const IMAGES_DIR = 'images';

function getDocumentDirectory(): string | null {
  return FileSystem.documentDirectory ?? null;
}

function getImagesDir(): string {
  const docDir = getDocumentDirectory();
  if (!docDir) throw new Error('Document directory not available');
  return `${docDir}${IMAGES_DIR}/`;
}

function generateImageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * DB-safe relative path (e.g. images/1234-abc.jpg).
 * Strips absolute/document prefixes so paths survive sandbox changes.
 */
export function normalizeStoredImagePath(path: string | null | undefined): string | null {
  if (path == null) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return null;

  if (trimmed.startsWith(`${IMAGES_DIR}/`)) return trimmed;

  if (trimmed.startsWith('content://')) return trimmed;

  let withoutScheme = trimmed;
  if (withoutScheme.startsWith('file://')) {
    withoutScheme = withoutScheme.slice('file://'.length);
  }

  const imagesSegment = `/images/`;
  const segmentIdx = withoutScheme.indexOf(imagesSegment);
  if (segmentIdx !== -1) {
    return withoutScheme.slice(segmentIdx + 1);
  }

  if (withoutScheme.startsWith('images/')) {
    return withoutScheme;
  }

  const filename = withoutScheme.split('/').pop();
  if (filename && /\.(jpe?g|png|webp|heic)$/i.test(filename)) {
    return `${IMAGES_DIR}/${filename}`;
  }

  return trimmed;
}

/** Absolute file URI for FileSystem operations. */
export function resolveImageFileUri(storedPath: string): string {
  const normalized = normalizeStoredImagePath(storedPath);
  if (!normalized) return storedPath;

  if (normalized.startsWith('content://') || normalized.startsWith('file://')) {
    return normalized;
  }

  if (normalized.startsWith(`${IMAGES_DIR}/`)) {
    const docDir = getDocumentDirectory();
    if (!docDir) return storedPath;
    return `${docDir}${normalized}`;
  }

  if (storedPath.startsWith('file://')) return storedPath;
  return storedPath.startsWith('/') ? `file://${storedPath}` : storedPath;
}

/**
 * Copy image from URI (e.g. from image picker) to app document directory.
 * Returns a relative path for DB storage.
 */
export async function saveImageFromUri(uri: string): Promise<string> {
  const dir = getImagesDir();
  const ext = uri.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const filename = `${generateImageId()}.${ext}`;
  const destUri = `${dir}${filename}`;
  const relativePath = `${IMAGES_DIR}/${filename}`;

  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    // Directory may already exist
  }

  await FileSystem.copyAsync({ from: uri, to: destUri });

  const info = await FileSystem.getInfoAsync(destUri);
  if (!info.exists) {
    throw new Error('Image copy failed: saved file not found');
  }

  return relativePath;
}

/**
 * Replace image at oldPath with new image from newUri.
 * Deletes old file and saves new one. Returns new relative path.
 */
export async function updateImage(oldPath: string, newUri: string): Promise<string> {
  const newPath = await saveImageFromUri(newUri);
  await deleteImage(oldPath);
  return newPath;
}

/**
 * Delete image file at stored path (relative or legacy absolute).
 */
export async function deleteImage(path: string): Promise<void> {
  if (!path) return;
  try {
    const fileUri = resolveImageFileUri(path);
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists) {
      await FileSystem.deleteAsync(fileUri);
    }
  } catch {
    // Ignore delete errors (file may already be gone)
  }
}

/** Whether the image file exists on disk for a stored path. */
export async function imageFileExists(storedPath: string | null | undefined): Promise<boolean> {
  if (!storedPath?.trim()) return false;
  try {
    const fileUri = resolveImageFileUri(storedPath);
    const info = await FileSystem.getInfoAsync(fileUri);
    return info.exists;
  } catch {
    return false;
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
  if (path.startsWith('content://')) return path;

  const normalized = normalizeStoredImagePath(path);
  if (!normalized) return null;

  if (normalized.startsWith(`${IMAGES_DIR}/`)) {
    const docDir = getDocumentDirectory();
    if (!docDir) return null;
    return `${docDir}${normalized}`;
  }

  if (path.startsWith('file://')) return path;
  return `file://${path}`;
}
