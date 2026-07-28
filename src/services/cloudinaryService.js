import { Readable } from 'stream';
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';

/**
 * Upload a PDF buffer to Cloudinary as a raw file.
 * Returns the secure URL and public ID for later retrieval/deletion.
 */
export async function uploadPdfToCloudinary(buffer, filename) {
  if (!isCloudinaryConfigured) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env',
    );
  }

  const baseName = filename.replace(/\.pdf$/i, '').replace(/[^\w.-]/g, '_');

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: 'bookmind/pdfs',
        public_id: `${baseName}_${Date.now()}`,
        format: 'pdf',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          bytes: result.bytes,
          format: result.format,
          resourceType: result.resource_type,
        });
      },
    );

    Readable.from(buffer).pipe(uploadStream);
  });
}

export async function deletePdfFromCloudinary(publicId) {
  if (!isCloudinaryConfigured || !publicId) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
}
