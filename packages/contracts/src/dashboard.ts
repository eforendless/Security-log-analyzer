import { z } from 'zod';

export const dashboardResponseSchema = z.object({
  dashboard: z.object({
    statistics: z.object({
      parsedEventCount: z.number().int().nonnegative(),
      parsedUploadCount: z.number().int().nonnegative(),
      skippedRecordCount: z.number().int().nonnegative(),
      uploadedCount: z.number().int().nonnegative(),
      uploadCount: z.number().int().nonnegative(),
    }),
    recentParsedUploads: z.array(
      z.object({
        createdAt: z.string().datetime(),
        earliestOccurredAt: z.string().datetime().nullable(),
        eventCount: z.number().int().nonnegative(),
        id: z.string().uuid(),
        latestOccurredAt: z.string().datetime().nullable(),
        originalFileName: z.string().min(1),
        skippedRecordCount: z.number().int().nonnegative(),
      }),
    ),
  }),
});

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
