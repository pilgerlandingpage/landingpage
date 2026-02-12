import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!

const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
})

export interface UploadResult {
    key: string
    url: string
}

/**
 * Upload a file to Cloudflare R2
 * @param buffer - File content as Buffer
 * @param fileName - Original file name (used for extension)
 * @param folder - Folder path (e.g. 'properties', 'landing-pages')
 * @param contentType - MIME type (e.g. 'image/jpeg')
 */
export async function uploadFile(
    buffer: Buffer,
    fileName: string,
    folder: string,
    contentType: string
): Promise<UploadResult> {
    const ext = fileName.split('.').pop() || 'jpg'
    const uniqueName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    await s3Client.send(
        new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: uniqueName,
            Body: buffer,
            ContentType: contentType,
        })
    )

    return {
        key: uniqueName,
        url: `${R2_PUBLIC_URL}/${uniqueName}`,
    }
}

/**
 * Delete a file from Cloudflare R2
 * @param key - Object key to delete
 */
export async function deleteFile(key: string): Promise<void> {
    await s3Client.send(
        new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
        })
    )
}

/**
 * Get the public URL for a file in R2
 * @param key - Object key
 */
export function getPublicUrl(key: string): string {
    return `${R2_PUBLIC_URL}/${key}`
}

/**
 * Upload an image from a base64-encoded string
 * @param base64Data - Base64-encoded image data (without the data URI prefix)
 * @param folder - Folder path (e.g. 'properties', 'landing-pages')
 * @param contentType - MIME type (e.g. 'image/jpeg')
 */
export async function uploadBase64Image(
    base64Data: string,
    folder: string,
    contentType: string = 'image/jpeg'
): Promise<UploadResult> {
    const buffer = Buffer.from(base64Data, 'base64')
    const ext = contentType.split('/')[1] || 'jpg'
    const fileName = `upload.${ext}`
    return uploadFile(buffer, fileName, folder, contentType)
}
