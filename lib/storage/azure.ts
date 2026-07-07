import { BlobServiceClient } from "@azure/storage-blob";

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.AZURE_STORAGE_DEFAULT_CONTAINER ?? "comprobantes";
const LOGOS_CONTAINER_NAME = process.env.AZURE_STORAGE_LOGOS_CONTAINER ?? "logos";

let blobServiceClient: BlobServiceClient | null = null;

function getClient(): BlobServiceClient {
  if (!CONNECTION_STRING) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING no está configurado en .env");
  }

  if (!blobServiceClient) {
    blobServiceClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
  }

  return blobServiceClient;
}

export async function uploadReceipt(bookingId: string, file: File): Promise<string> {
  const client = getClient();
  const containerClient = client.getContainerClient(CONTAINER_NAME);
  await containerClient.createIfNotExists();

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const blobName = `${bookingId}-${Date.now()}.${extension}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  const arrayBuffer = await file.arrayBuffer();
  await blockBlobClient.uploadData(Buffer.from(arrayBuffer), {
    blobHTTPHeaders: { blobContentType: file.type || "application/octet-stream" },
  });

  return blockBlobClient.url;
}

export async function uploadOrganizationLogo(orgSlug: string, file: File): Promise<string> {
  const client = getClient();
  const containerClient = client.getContainerClient(LOGOS_CONTAINER_NAME);
  await containerClient.createIfNotExists({ access: "blob" });

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const blobName = `${orgSlug}-${Date.now()}.${extension}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  const arrayBuffer = await file.arrayBuffer();
  await blockBlobClient.uploadData(Buffer.from(arrayBuffer), {
    blobHTTPHeaders: { blobContentType: file.type || "application/octet-stream" },
  });

  return blockBlobClient.url;
}
