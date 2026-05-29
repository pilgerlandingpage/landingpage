import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

type R2Config = {
    accountId: string
    accessKeyId: string
    secretAccessKey: string
    bucketName: string
    publicUrl: string
}

let cachedConfig: R2Config | null = null
let cachedClient: S3Client | null = null
let cachedClientKey = ''

export interface UploadResult {
    key: string
    url: string
}

async function loadR2Config(): Promise<R2Config> {
    const envConfig = {
        accountId: process.env.R2_ACCOUNT_ID || '',
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        bucketName: process.env.R2_BUCKET_NAME || '',
        publicUrl: process.env.R2_PUBLIC_URL || '',
    }

    if (Object.values(envConfig).every(Boolean)) {
        cachedConfig = {
            ...envConfig,
            publicUrl: envConfig.publicUrl.replace(/\/$/, ''),
        }
        return cachedConfig
    }

    if (cachedConfig) return cachedConfig

    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('R2 nao configurado: variaveis do Supabase ausentes para carregar app_config.')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data, error } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', ['r2_account_id', 'r2_access_key_id', 'r2_secret_access_key', 'r2_bucket_name', 'r2_public_url'])

    if (error) throw error

    const configMap = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')])) as Record<string, string>
    const dbConfig = {
        accountId: configMap.r2_account_id || envConfig.accountId,
        accessKeyId: configMap.r2_access_key_id || envConfig.accessKeyId,
        secretAccessKey: configMap.r2_secret_access_key || envConfig.secretAccessKey,
        bucketName: configMap.r2_bucket_name || envConfig.bucketName,
        publicUrl: (configMap.r2_public_url || envConfig.publicUrl).replace(/\/$/, ''),
    }

    const missing = Object.entries(dbConfig)
        .filter(([, value]) => !value)
        .map(([key]) => key)

    if (missing.length > 0) {
        throw new Error(`R2 nao configurado. Campos ausentes: ${missing.join(', ')}`)
    }

    cachedConfig = dbConfig
    return cachedConfig
}

async function getR2Client() {
    const config = await loadR2Config()
    const clientKey = `${config.accountId}:${config.accessKeyId}:${config.bucketName}`

    if (!cachedClient || cachedClientKey !== clientKey) {
        cachedClient = new S3Client({
            region: 'auto',
            endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
        })
        cachedClientKey = clientKey
    }

    return { client: cachedClient, config }
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
    const { client, config } = await getR2Client()
    const ext = fileName.split('.').pop() || 'jpg'
    const uniqueName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    await client.send(
        new PutObjectCommand({
            Bucket: config.bucketName,
            Key: uniqueName,
            Body: buffer,
            ContentType: contentType,
        })
    )

    return {
        key: uniqueName,
        url: `${config.publicUrl}/${uniqueName}`,
    }
}

/**
 * Delete a file from Cloudflare R2
 * @param key - Object key to delete
 */
export async function deleteFile(key: string): Promise<void> {
    const { client, config } = await getR2Client()
    await client.send(
        new DeleteObjectCommand({
            Bucket: config.bucketName,
            Key: key,
        })
    )
}

/**
 * Get the public URL for a file in R2
 * @param key - Object key
 */
export function getPublicUrl(key: string): string {
    const publicUrl = process.env.R2_PUBLIC_URL || cachedConfig?.publicUrl || ''
    if (!publicUrl) return key
    return `${publicUrl.replace(/\/$/, '')}/${key}`
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
