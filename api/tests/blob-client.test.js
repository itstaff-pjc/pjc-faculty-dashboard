jest.mock('@azure/storage-blob');
jest.mock('@azure/identity');

const { Readable } = require('stream');

process.env.STORAGE_ACCOUNT_NAME = 'testaccount';

function makeStream(text) {
  const stream = new Readable();
  stream.push(Buffer.from(text));
  stream.push(null);
  return stream;
}

let mockUpload;
let mockDownload;
let mockGetBlockBlobClient;
let mockGetBlobClient;
let mockGetContainerClient;
let BlobServiceClient;
let DefaultAzureCredential;

beforeEach(() => {
  jest.resetModules();
  const { BlobServiceClient: BSC } = require('@azure/storage-blob');
  const { DefaultAzureCredential: DAC } = require('@azure/identity');
  BlobServiceClient = BSC;
  DefaultAzureCredential = DAC;

  mockUpload = jest.fn().mockResolvedValue({});
  mockDownload = jest.fn();
  mockGetBlockBlobClient = jest.fn().mockReturnValue({ upload: mockUpload });
  mockGetBlobClient = jest.fn().mockReturnValue({ download: mockDownload });
  mockGetContainerClient = jest.fn().mockReturnValue({
    getBlobClient: mockGetBlobClient,
    getBlockBlobClient: mockGetBlockBlobClient,
  });
  BlobServiceClient.mockImplementation(() => ({
    getContainerClient: mockGetContainerClient,
  }));
  DefaultAzureCredential.mockImplementation(() => ({}));
});

test('readBlob fetches from correct container and blob name, returns parsed JSON', async () => {
  const data = { instructors: [{ userId: '_1_1', name: 'Smith, Jane' }] };
  mockDownload.mockResolvedValue({ readableStreamBody: makeStream(JSON.stringify(data)) });

  const { readBlob } = require('../_shared/blob-client');
  const result = await readBlob('instructors.json');

  expect(result).toEqual(data);
  expect(BlobServiceClient).toHaveBeenCalledWith(
    'https://testaccount.blob.core.windows.net',
    expect.any(Object)
  );
  expect(mockGetContainerClient).toHaveBeenCalledWith('faculty-dashboard-data');
  expect(mockGetBlobClient).toHaveBeenCalledWith('instructors.json');
});

test('writeBlob uploads JSON string with application/json content type', async () => {
  const { writeBlob } = require('../_shared/blob-client');
  const data = { lastSync: '2026-03-28T05:00:00Z', status: 'ok' };
  await writeBlob('meta.json', data);

  const expectedContent = JSON.stringify(data);
  expect(mockGetContainerClient).toHaveBeenCalledWith('faculty-dashboard-data');
  expect(mockGetBlockBlobClient).toHaveBeenCalledWith('meta.json');
  expect(mockUpload).toHaveBeenCalledWith(
    expectedContent,
    Buffer.byteLength(expectedContent),
    { blobHTTPHeaders: { blobContentType: 'application/json' } }
  );
});

test('readBlob propagates storage errors to caller', async () => {
  mockDownload.mockRejectedValue(new Error('BlobNotFound'));

  const { readBlob } = require('../_shared/blob-client');
  await expect(readBlob('missing.json')).rejects.toThrow('BlobNotFound');
});
