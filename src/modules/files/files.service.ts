import path from "node:path";

export class FilesService {
  toResponse(file: Express.Multer.File) {
    return {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      filename: file.filename,
      path: file.path,
      urlPath: `/uploads/${path.basename(file.path)}`,
    };
  }
}

export const filesService = new FilesService();
