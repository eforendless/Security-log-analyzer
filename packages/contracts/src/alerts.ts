import { z } from 'zod';

export const alertSeveritySchema = z.enum(['informational', 'low', 'medium', 'high', 'critical']);
export const alertStatusSchema = z.enum(['open', 'triaged']);

export const mitreTechniqueSchema = z.object({
  id: z.string().regex(/^T[0-9]{4}(\.[0-9]{3})?$/),
  name: z.string().min(1).max(200),
});

export const alertAnalysisSchema = z.object({
  confidence: z.number().min(0).max(1),
  createdAt: z.string().datetime(),
  explanation: z.string().min(1).max(2_000),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  recommendations: z.array(z.string().min(1).max(400)).max(5),
  severity: alertSeveritySchema,
  summary: z.string().min(1).max(500),
  techniques: z.array(mitreTechniqueSchema).max(5),
});

const alertSummarySchema = z.object({
  eventId: z.number().int().nonnegative(),
  host: z.string().min(1).nullable(),
  id: z.string().min(1),
  occurredAt: z.string().datetime(),
  provider: z.string().min(1),
  severity: alertSeveritySchema,
  status: alertStatusSchema,
});

export const alertDetailSchema = alertSummarySchema.extend({
  analysis: alertAnalysisSchema.nullable(),
  level: z.string().min(1),
  message: z.string(),
  sourceRecord: z.number().int().positive(),
  triageNote: z.string().nullable(),
  triageUpdatedAt: z.string().datetime().nullable(),
  uploadId: z.string().uuid(),
  user: z.string().min(1).nullable(),
});

export const alertsResponseSchema = z.object({
  alerts: z.array(alertSummarySchema),
});

export const alertResponseSchema = z.object({
  alert: alertDetailSchema,
});

export const updateAlertTriageRequestSchema = z
  .object({
    note: z.string().trim().max(2_000).nullable(),
    status: alertStatusSchema,
  })
  .strict();

export type AlertDetail = z.infer<typeof alertDetailSchema>;
export type AlertAnalysis = z.infer<typeof alertAnalysisSchema>;
export type AlertResponse = z.infer<typeof alertResponseSchema>;
export type AlertSeverity = z.infer<typeof alertSeveritySchema>;
export type AlertStatus = z.infer<typeof alertStatusSchema>;
export type AlertsResponse = z.infer<typeof alertsResponseSchema>;
export type UpdateAlertTriageRequest = z.infer<typeof updateAlertTriageRequestSchema>;
