import type { LogParseSummary, ParsedLog, SecurityEvent } from '@security-log-analyzer/domain';

export type SourceRecord = Record<string, unknown>;

export function buildParsedLog(
  records: readonly SourceRecord[],
  skippedRecordCount: number,
): ParsedLog {
  const events: SecurityEvent[] = [];
  let skippedRecords = skippedRecordCount;

  records.forEach((record, index) => {
    const sourceRecord =
      typeof record.__sourceRecord === 'number' && Number.isSafeInteger(record.__sourceRecord)
        ? record.__sourceRecord
        : index + 1;
    const event = normalizeEvent(record, sourceRecord);

    if (event === undefined) {
      skippedRecords += 1;
      return;
    }

    events.push(event);
  });

  return {
    events,
    summary: summarize(events, skippedRecords),
  };
}

function normalizeEvent(record: SourceRecord, sourceRecord: number): SecurityEvent | undefined {
  const occurredAt = parseOccurredAt(
    readValue(record, ['timestamp', 'occurredAt', 'timeCreated', 'systemTime']),
  );
  const provider = readString(record, ['provider', 'providerName', 'source']);
  const eventId = parseEventId(readValue(record, ['eventId', 'id']));

  if (occurredAt === undefined || provider === undefined || eventId === undefined) {
    return undefined;
  }

  return {
    eventId,
    host: readString(record, ['host', 'computer', 'machineName', 'workstationName']),
    level: normalizeWindowsLevel(readString(record, ['level', 'levelName'])),
    message: readString(record, ['message', 'renderedMessage', 'description']) ?? '',
    occurredAt,
    provider,
    sourceRecord,
    user: readString(record, [
      'user',
      'userName',
      'targetUserName',
      'subjectUserName',
      'accountName',
      'samAccountName',
    ]),
  };
}

function normalizeWindowsLevel(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case '1':
      return 'critical';
    case '2':
      return 'error';
    case '3':
      return 'warning';
    case '4':
      return 'information';
    case '5':
      return 'verbose';
    default:
      return normalized ?? 'information';
  }
}

function summarize(events: readonly SecurityEvent[], skippedRecordCount: number): LogParseSummary {
  const providers = new Map<string, number>();
  const eventIds = new Map<string, number>();
  let earliestOccurredAt: Date | undefined;
  let latestOccurredAt: Date | undefined;

  for (const event of events) {
    providers.set(event.provider, (providers.get(event.provider) ?? 0) + 1);
    const eventId = String(event.eventId);
    eventIds.set(eventId, (eventIds.get(eventId) ?? 0) + 1);

    if (earliestOccurredAt === undefined || event.occurredAt < earliestOccurredAt) {
      earliestOccurredAt = event.occurredAt;
    }

    if (latestOccurredAt === undefined || event.occurredAt > latestOccurredAt) {
      latestOccurredAt = event.occurredAt;
    }
  }

  return {
    earliestOccurredAt,
    eventCount: events.length,
    eventsById: toSortedRecord(eventIds, (left, right) => Number(left) - Number(right)),
    eventsByProvider: toSortedRecord(providers, compareStrings),
    latestOccurredAt,
    skippedRecordCount,
  };
}

function readValue(record: SourceRecord, aliases: readonly string[]): unknown {
  for (const alias of aliases) {
    const matchedKey = Object.keys(record).find((key) => key.toLowerCase() === alias.toLowerCase());

    if (matchedKey !== undefined) {
      return record[matchedKey];
    }
  }

  return undefined;
}

function readString(record: SourceRecord, aliases: readonly string[]): string | undefined {
  const value = readValue(record, aliases);

  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized === '' ? undefined : normalized;
}

function parseOccurredAt(value: unknown): Date | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const occurredAt = new Date(value);
  return Number.isNaN(occurredAt.getTime()) ? undefined : occurredAt;
}

function parseEventId(value: unknown): number | undefined {
  const rawValue = typeof value === 'number' ? String(value) : value;

  if (typeof rawValue !== 'string' || !/^\d+$/.test(rawValue.trim())) {
    return undefined;
  }

  const eventId = Number(rawValue);
  return Number.isSafeInteger(eventId) && eventId >= 0 ? eventId : undefined;
}

function toSortedRecord(
  values: ReadonlyMap<string, number>,
  compare: (left: string, right: string) => number,
): Readonly<Record<string, number>> {
  return Object.fromEntries([...values.entries()].sort(([left], [right]) => compare(left, right)));
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
