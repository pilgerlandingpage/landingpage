import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
})

export async function uploadImageToR2(url: string, key: string) {
    try {
        const response = await fetch(url)
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const contentType = response.headers.get('content-type') || 'image/jpeg'

        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        })

        await r2.send(command)

        // Return Public URL
        // Assuming R2 bucket is public or has a custom domain
        const publicDomain = process.env.R2_PUBLIC_DOMAIN || `https://${process.env.R2_BUCKET_NAME}.r2.dev`
        return `${publicDomain}/${key}`
    } catch (error) {
        console.error('R2 Upload Error:', error)
        // Fallback to original URL if upload fails
        return url
    }
}
