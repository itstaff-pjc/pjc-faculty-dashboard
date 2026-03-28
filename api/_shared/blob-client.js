const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');

const CONTAINER = 'faculty-dashboard-data';

function getBlobServiceClient() {
  const accountName = process.env.STORAGE_ACCOUNT_NAME;
  const credential = new DefaultAzureCredential();
  return new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential
  );
}

async function readBlob(blobName) {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(CONTAINER);
  const blobClient = containerClient.getBlobClient(blobName);
  const download = await blobClient.download();
  const chunks = [];
  for await (const chunk of download.readableStreamBody) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}

async function writeBlob(blobName, data) {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(CONTAINER);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const content = JSON.stringify(data);
  await blockBlobClient.upload(content, Buffer.byteLength(content), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
  });
}

module.exports = { readBlob, writeBlob };
