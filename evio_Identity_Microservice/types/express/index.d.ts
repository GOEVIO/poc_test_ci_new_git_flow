import type { File } from "multer";

declare global {
  namespace Express {
    interface Request {
      files?: File[];
      file?: File;
    }
  }
}

export {};
