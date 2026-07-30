import type {
  AlertSeverity,
  MitreTechnique,
  RedactedAlertAnalysisInput,
  SecurityAnalysisProvider,
  SecurityAnalysisResult,
} from '@security-log-analyzer/domain';
import {
  SecurityAnalysisProviderError,
  SecurityAnalysisUnavailableError,
} from '@security-log-analyzer/domain';

const DEFAULT_TIMEOUT_MS = 15_000;
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const validSeverities = new Set<AlertSeverity>([
  'informational',
  'low',
  'medium',
  'high',
  'critical',
]);

interface OpenAiSecurityAnalysisProviderOptions {
  readonly apiKey: string;
  readonly fetchImplementation?: typeof fetch;
  readonly model: string;
  readonly timeoutMs?: number;
}

export class OpenAiSecurityAnalysisProvider implements SecurityAnalysisProvider {
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;

  public constructor(private readonly options: OpenAiSecurityAnalysisProviderOptions) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  public async analyze(input: RedactedAlertAnalysisInput): Promise<SecurityAnalysisResult> {
    let response: Response;

    try {
      response = await this.fetchImplementation(OPENAI_RESPONSES_URL, {
        body: JSON.stringify({
          input: [
            {
              content: [
                {
                  text: systemInstructions,
                  type: 'input_text',
                },
              ],
              role: 'system',
            },
            {
              content: [
                {
                  text: JSON.stringify(input),
                  type: 'input_text',
                },
              ],
              role: 'user',
            },
          ],
          model: this.options.model,
          store: false,
          text: {
            format: {
              name: 'security_alert_analysis',
              schema: analysisJsonSchema,
              strict: true,
              type: 'json_schema',
            },
          },
        }),
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'content-type': 'application/json',
        },
        method: 'POST',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new SecurityAnalysisProviderError('The AI analysis request timed out.');
      }

      throw new SecurityAnalysisProviderError('The AI analysis provider could not be reached.');
    }

    if (!response.ok) {
      throw new SecurityAnalysisProviderError(
        `The AI analysis provider rejected the request (HTTP ${response.status}).`,
      );
    }

    const body = (await response.json()) as unknown;
    const output = extractOutputText(body);

    try {
      return parseAnalysisResult(JSON.parse(output) as unknown, this.options.model);
    } catch {
      throw new SecurityAnalysisProviderError(
        'The AI analysis provider returned an invalid response.',
      );
    }
  }
}

export class UnavailableSecurityAnalysisProvider implements SecurityAnalysisProvider {
  public async analyze(): Promise<SecurityAnalysisResult> {
    throw new SecurityAnalysisUnavailableError(
      'AI analysis is unavailable because OPENAI_API_KEY is not configured on the server.',
    );
  }
}

const systemInstructions = [
  'You are a security operations analyst.',
  'Analyze only the supplied redacted security-event evidence.',
  'Do not infer facts absent from the evidence or include sensitive data.',
  'Return the requested JSON object with concise, actionable recommendations.',
].join(' ');

const analysisJsonSchema = {
  additionalProperties: false,
  properties: {
    confidence: { maximum: 1, minimum: 0, type: 'number' },
    explanation: { maxLength: 2_000, minLength: 1, type: 'string' },
    recommendations: {
      items: { maxLength: 400, minLength: 1, type: 'string' },
      maxItems: 5,
      type: 'array',
    },
    severity: { enum: ['informational', 'low', 'medium', 'high', 'critical'], type: 'string' },
    summary: { maxLength: 500, minLength: 1, type: 'string' },
    techniques: {
      items: {
        additionalProperties: false,
        properties: {
          id: { pattern: '^T[0-9]{4}(\\.[0-9]{3})?$', type: 'string' },
          name: { maxLength: 200, minLength: 1, type: 'string' },
        },
        required: ['id', 'name'],
        type: 'object',
      },
      maxItems: 5,
      type: 'array',
    },
  },
  required: ['severity', 'confidence', 'summary', 'explanation', 'techniques', 'recommendations'],
  type: 'object',
} as const;

function extractOutputText(value: unknown): string {
  if (!isRecord(value)) {
    throw new Error('Invalid provider response.');
  }

  if (typeof value.output_text === 'string') {
    return value.output_text;
  }

  if (!Array.isArray(value.output)) {
    throw new Error('Invalid provider response.');
  }

  for (const outputItem of value.output) {
    if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) {
      continue;
    }

    for (const contentItem of outputItem.content) {
      if (
        isRecord(contentItem) &&
        contentItem.type === 'output_text' &&
        typeof contentItem.text === 'string'
      ) {
        return contentItem.text;
      }
    }
  }

  throw new Error('Invalid provider response.');
}

function parseAnalysisResult(value: unknown, model: string): SecurityAnalysisResult {
  if (!isRecord(value)) {
    throw new Error('Invalid analysis result.');
  }

  const { confidence, explanation, recommendations, severity, summary, techniques } = value;

  if (
    !isConfidence(confidence) ||
    !isBoundedString(explanation, 2_000) ||
    !isBoundedStringArray(recommendations, 5, 400) ||
    typeof severity !== 'string' ||
    !validSeverities.has(severity as AlertSeverity) ||
    !isBoundedString(summary, 500) ||
    !isMitreTechniques(techniques)
  ) {
    throw new Error('Invalid analysis result.');
  }

  return {
    confidence,
    explanation,
    model,
    recommendations,
    severity: severity as AlertSeverity,
    summary,
    techniques,
  };
}

function isBoundedString(value: unknown, maximumLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximumLength;
}

function isBoundedStringArray(
  value: unknown,
  maximumItems: number,
  maximumLength: number,
): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length <= maximumItems &&
    value.every((item) => isBoundedString(item, maximumLength))
  );
}

function isConfidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isMitreTechniques(value: unknown): value is readonly MitreTechnique[] {
  return (
    Array.isArray(value) &&
    value.length <= 5 &&
    value.every(
      (technique) =>
        isRecord(technique) &&
        typeof technique.id === 'string' &&
        /^T[0-9]{4}(\.[0-9]{3})?$/.test(technique.id) &&
        isBoundedString(technique.name, 200),
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
