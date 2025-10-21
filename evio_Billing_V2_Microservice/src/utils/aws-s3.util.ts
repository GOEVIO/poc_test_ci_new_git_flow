import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Returns a configured S3 client.
 */
function getS3Client(): S3Client {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials or region are missing in environment variables');
  }

  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * Gets the S3 bucket name from environment variables.
 */
function getS3BucketName(): string {
  const bucketName = process.env.S3_BUCKET_NAME;
  if (!bucketName) throw new Error('S3_BUCKET_NAME not defined in environment variables');
  return bucketName;
}

/**
 * Uploads a file to AWS S3.
 * @param fileBuffer File content as Buffer
 * @param fileName Name of the file in the bucket
 * @param contentType MIME type of the file
 * @returns URL of the uploaded file in S3
 * @throws Error if upload fails or environment variables are missing
 */
async function uploadFileToS3(
  fileBuffer: Buffer,
  fileName: string,
  contentType = 'application/octet-stream'
): Promise<string> {
  const bucketName = getS3BucketName();
  const region = process.env.AWS_REGION!;
  const s3Client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: fileBuffer,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    return `https://${bucketName}.s3.${region}.amazonaws.com/${fileName}`;
  } catch (error) {
    console.error(`Failed to upload file to S3:`, error);
    throw error;
  }
}

/**
 * Builds a file name for S3 uploads.
 * @param prefix Prefix for the file 
 * @param baseName Base name for the file
 * @param extension File extension (e.g., 'json', 'pdf')
 * @returns A string in the format: prefix/year/month/baseName.extension
 */
function buildS3FileName(prefix: string, baseName: string, extension: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${prefix}/${year}/${month}/${baseName}.${extension}`;
}

/**
 * Downloads a file from AWS S3.
 * @param fileName Name (key) of the file in the bucket
 * @returns Buffer with the file content
 * @throws Error if download fails or environment variables are missing
 */
async function downloadFileFromS3(fileName: string): Promise<Buffer> {
  const bucketName = getS3BucketName();
  const s3Client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: fileName,
  });

  try {
    const response = await s3Client.send(command);
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } catch (error) {
    console.error(`Failed to download file from S3:`, error);
    throw error;
  }
}

export { uploadFileToS3, buildS3FileName, downloadFileFromS3 };
