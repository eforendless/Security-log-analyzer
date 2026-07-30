import { parse as parseCsv } from 'csv-parse/sync';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  TextLogParseError,
  type ParsedLog,
  type TextLogParser,
} from '@security-log-analyzer/domain';
import { buildParsedLog, type SourceRecord } from './event-normalizer.js';

export class SupportedTextLogParser implements TextLogParser {
  public async parse(input: {
    content: Uint8Array;
    mediaType: string;
    originalFileName: string;
  }): Promise<ParsedLog> {
    const text = decodeText(input.content);
    const extension = extensionOf(input.originalFileName);

    switch (extension) {
      case '.csv':
        return buildParsedLog(readCsvRecords(text), 0);
      case '.json':
        return buildParsedLog(readJsonRecords(text), 0);
      case '.xml':
        return buildParsedLog(readXmlRecords(text), 0);
      case '.log':
      case '.txt': {
        const lineRecords = readLineRecords(text);
        return buildParsedLog(lineRecords.records, lineRecords.skippedRecordCount);
      }
      default:
        throw new TextLogParseError('The uploaded text export format is not supported.');
    }
  }
}

function decodeText(content: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(content);
  } catch {
    throw new TextLogParseError('The uploaded text export must be valid UTF-8.');
  }
}

function extensionOf(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot === -1 ? '' : fileName.slice(lastDot).toLowerCase();
}

function readLineRecords(text: string): { records: SourceRecord[]; skippedRecordCount: number } {
  const records: SourceRecord[] = [];
  let skippedRecordCount = 0;

  for (const [lineIndex, line] of text.split(/\r?\n/u).entries()) {
    const trimmedLine = line.trim();

    if (trimmedLine === '') {
      continue;
    }

    const match = /^(\S+)\s+(\S+)\s+(\S+)\s+(\d+)(?:\s+(.*))?$/u.exec(trimmedLine);

    if (match === null) {
      skippedRecordCount += 1;
      continue;
    }

    const [, timestamp, level, provider, eventId, remainder = ''] = match;
    const attributes = readLineAttributes(remainder);
    const message = remainder.replace(/(?:^|\s)(?:host|user)=(?:"[^"]*"|\S+)/gu, ' ').trim();

    records.push({
      __sourceRecord: lineIndex + 1,
      eventId,
      host: attributes.host,
      level,
      message,
      provider,
      timestamp,
      user: attributes.user,
    });
  }

  return { records, skippedRecordCount };
}

function readLineAttributes(value: string): { host: string | undefined; user: string | undefined } {
  const attributes = new Map<string, string>();
  const expression = /(?:^|\s)(host|user)=("[^"]*"|\S+)/gu;

  for (const match of value.matchAll(expression)) {
    const key = match[1];
    const rawValue = match[2];

    if (key !== undefined && rawValue !== undefined) {
      attributes.set(key, rawValue.replace(/^"|"$/gu, ''));
    }
  }

  return {
    host: attributes.get('host'),
    user: attributes.get('user'),
  };
}

function readCsvRecords(text: string): SourceRecord[] {
  try {
    return parseCsv(text, {
      columns: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    }) as SourceRecord[];
  } catch {
    throw new TextLogParseError('The CSV log export is invalid.');
  }
}

function readJsonRecords(text: string): SourceRecord[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new TextLogParseError('The JSON log export is invalid.');
  }

  const records = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.events)
      ? parsed.events
      : undefined;

  if (records === undefined) {
    throw new TextLogParseError('The JSON log export must contain an event array.');
  }

  return records.filter(isRecord);
}

function readXmlRecords(text: string): SourceRecord[] {
  const validation = XMLValidator.validate(text);

  if (validation !== true) {
    throw new TextLogParseError('The XML log export is invalid.');
  }

  const document = new XMLParser({ attributeNamePrefix: '@_', ignoreAttributes: false }).parse(
    text,
  ) as unknown;
  const root = isRecord(document) ? document : undefined;
  const events = root === undefined ? undefined : readXmlEvents(root);

  if (events === undefined) {
    throw new TextLogParseError('The XML log export does not contain event records.');
  }

  return events.map(toXmlSourceRecord);
}

function readXmlEvents(document: SourceRecord): SourceRecord[] | undefined {
  const eventsContainer = asRecord(document.Events) ?? asRecord(document.events);
  const eventValue =
    eventsContainer?.Event ?? eventsContainer?.event ?? document.Event ?? document.event;

  if (Array.isArray(eventValue)) {
    return eventValue.filter(isRecord);
  }

  return isRecord(eventValue) ? [eventValue] : undefined;
}

function toXmlSourceRecord(event: SourceRecord): SourceRecord {
  const system = asRecord(event.System) ?? asRecord(event.system) ?? {};
  const eventData = asRecord(event.EventData) ?? asRecord(event.eventData) ?? {};
  const renderingInfo = asRecord(event.RenderingInfo) ?? asRecord(event.renderingInfo) ?? {};
  const provider = asString(system.Provider) ?? asString(asRecord(system.Provider)?.['@_Name']);
  const timeCreated = asRecord(system.TimeCreated) ?? {};

  return {
    computer: asString(system.Computer),
    eventId: asString(system.EventID),
    level: xmlLevel(asString(system.Level)),
    message: asString(renderingInfo.Message) ?? asString(event.Message),
    provider,
    targetUserName: xmlDataValue(eventData.Data, 'TargetUserName'),
    timeCreated: asString(timeCreated['@_SystemTime']),
  };
}

function xmlDataValue(value: unknown, fieldName: string): string | undefined {
  const dataElements = Array.isArray(value) ? value : [value];

  for (const element of dataElements) {
    const data = asRecord(element);

    if (data?.['@_Name'] === fieldName) {
      return asString(data['#text']) ?? asString(data);
    }
  }

  return undefined;
}

function xmlLevel(value: string | undefined): string {
  const levels: Readonly<Record<string, string>> = {
    '1': 'critical',
    '2': 'error',
    '3': 'warning',
    '4': 'information',
    '5': 'verbose',
  };

  return value === undefined ? 'information' : (levels[value] ?? value);
}

function asRecord(value: unknown): SourceRecord | undefined {
  return isRecord(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized === '' ? undefined : normalized;
}

function isRecord(value: unknown): value is SourceRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
