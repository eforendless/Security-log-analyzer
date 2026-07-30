import { z } from 'zod';

export const settingsResponseSchema = z.object({
  settings: z.object({
    aiAnalysis: z.object({
      configured: z.boolean(),
      model: z.string().min(1),
      timeoutMs: z.number().int().positive(),
    }),
    maximumUploadBytes: z.number().int().positive(),
  }),
});

export type SettingsResponse = z.infer<typeof settingsResponseSchema>;
