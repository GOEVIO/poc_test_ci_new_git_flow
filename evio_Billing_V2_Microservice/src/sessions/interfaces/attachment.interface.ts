export interface Attachment {
  filename: string;
  content: Buffer | string | ArrayBuffer;
  contentType: string;
  encoding: 'base64';
}