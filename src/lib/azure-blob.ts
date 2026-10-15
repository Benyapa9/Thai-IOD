import "server-only";
import { BlobServiceClient } from "@azure/storage-blob";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME ?? "iod-uploads";

export const blobConfigured = !!connectionString;

/**
 * Stores an uploaded source file. Without Azure Storage configured (local dev)
 * the file is not persisted and a `local://` placeholder URL is returned.
 */
export async function uploadBlob(name: string, data: Buffer, contentType: string) {
  if (!connectionString) return `local://${name}`;

  const container = BlobServiceClient.fromConnectionString(connectionString).getContainerClient(
    containerName,
  );
  await container.createIfNotExists();
  const blob = container.getBlockBlobClient(name);
  await blob.uploadData(data, { blobHTTPHeaders: { blobContentType: contentType } });
  return blob.url;
}
