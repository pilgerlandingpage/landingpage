import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

export async function uploadImageToR2(url: string, key: string) {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY! // Only server-side
        )

        const { data: configsData } = await supabase.from('app_config').select('key, value')
        const configs = configsData?.reduce((acc: any, row) => ({ ...acc, [row.key]: row.value }), {}) || {}

        const accountId = configs['r2_account_id'] || process.env.R2_ACCOUNT_ID
        const accessKeyId = configs['r2_access_key_id'] || process.env.R2_ACCESS_KEY_ID
        const secretAccessKey = configs['r2_secret_access_key'] || process.env.R2_SECRET_ACCESS_KEY
        const bucketName = configs['r2_bucket_name'] || process.env.R2_BUCKET_NAME
        const publicUrl = configs['r2_public_url'] || process.env.R2_PUBLIC_DOMAIN || `https://${bucketName}.r2.dev`

        if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
            console.error('Missing R2 configurations.')
            return url
        }

        const r2 = new S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey,
            },
        })

        const response = await fetch(url)
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const contentType = response.headers.get('content-type') || 'image/jpeg'

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        })

        await r2.send(command)

        return `${publicUrl.replace(/\/$/, '')}/${key}`
    } catch (error) {
        console.error('R2 Upload Error:', error)
        // Fallback to original URL if upload fails
        return url
    }
}
