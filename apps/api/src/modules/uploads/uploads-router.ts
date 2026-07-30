import { randomUUID } from 'node:crypto';
import {
  CreateUpload,
  GetUploadStatus,
  UploadValidationError,
} from '@security-log-analyzer/application';
import { isSupportedTextLogFile, uploadResponseSchema } from '@security-log-analyzer/contracts';
import {
  LocalUploadFileStorage,
  LocalUploadRepository,
  SupportedTextLogParser,
} from '@security-log-analyzer/infrastructure';
import { Router } from 'express';
import multer from 'multer';
import type { Environment } from '../../config/environment.js';
import { asyncRoute } from '../../middleware/async-route.js';
import { toUploadResponse } from './upload-response.js';

const uploadFieldName = 'file';

export function createUploadsRouter(environment: Environment): Router {
  const router = Router();
  const fileStorage = new LocalUploadFileStorage(environment.uploadStorageDirectory);
  const uploadRepository = new LocalUploadRepository(environment.uploadStorageDirectory);
  const parser = new SupportedTextLogParser();
  const createUpload = new CreateUpload({
    createUploadId: randomUUID,
    fileStorage,
    maximumUploadBytes: environment.maximumUploadBytes,
    now: () => new Date(),
    parser,
    uploadRepository,
  });
  const getUploadStatus = new GetUploadStatus(uploadRepository);
  const multipartUpload = multer({
    limits: {
      fileSize: environment.maximumUploadBytes,
      files: 1,
    },
    storage: multer.memoryStorage(),
  });

  router.post(
    '/',
    multipartUpload.single(uploadFieldName),
    asyncRoute(async (request, response) => {
      const file = request.file;

      if (file === undefined) {
        throw new UploadValidationError(`A '${uploadFieldName}' file is required.`);
      }

      if (!isSupportedTextLogFile(file.originalname, file.mimetype)) {
        throw new UploadValidationError('Only supported text log exports may be uploaded.');
      }

      const upload = await createUpload.execute({
        content: file.buffer,
        mediaType: file.mimetype,
        originalFileName: file.originalname,
      });

      response.status(201).json(uploadResponseSchema.parse(toUploadResponse(upload)));
    }),
  );

  router.get(
    '/:uploadId',
    asyncRoute(async (request, response) => {
      const uploadId = request.params.uploadId;

      if (typeof uploadId !== 'string' || !isUuid(uploadId)) {
        throw new UploadValidationError('The upload ID must be a valid UUID.');
      }

      const upload = await getUploadStatus.execute(uploadId);
      response.status(200).json(uploadResponseSchema.parse(toUploadResponse(upload)));
    }),
  );

  return router;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
