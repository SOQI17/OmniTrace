// ─── Cloudinary helpers ───────────────────────────────────────
export const CLOUDINARY_CONFIG = {
  cloudName:    import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string,
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string,
};

export async function uploadDocToStorage(
  file: File,
  _docId: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  formData.append('folder', 'omnitrace/documents');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress?.(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        const res = JSON.parse(xhr.responseText);
        resolve(res.secure_url);
      } else {
        reject(new Error(`Cloudinary error ${xhr.status}: ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error('Error de red al subir archivo'));
    xhr.send(formData);
  });
}

export async function deleteDocFromStorage(_url: string): Promise<void> {
  // No-op en cliente: Cloudinary no permite delete sin API secret por seguridad.
}
