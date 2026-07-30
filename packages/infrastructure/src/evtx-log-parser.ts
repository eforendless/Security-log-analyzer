import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readResolvedEvents, type ResolvedEvent } from '@ts-evtx/core';
import { TextLogParseError, type LogParser, type ParsedLog } from '@security-log-analyzer/domain';
import { buildParsedLog, type SourceRecord } from './event-normalizer.js';

const DEFAULT_MAXIMUM_RECORDS = 10_000;
const MAXIMUM_FALLBACK_MESSAGE_LENGTH = 4_000;

interface EvtxEventReader {
  read(filePath: string): AsyncIterable<ResolvedEvent>;
}

interface EvtxLogParserOptions {
  readonly maximumRecords?: number;
  readonly reader?: EvtxEventReader;
}

export class EvtxLogParser implements LogParser {
  private readonly maximumRecords: number;
  private readonly reader: EvtxEventReader;

  public constructor(options: EvtxLogParserOptions = {}) {
    this.maximumRecords = options.maximumRecords ?? DEFAULT_MAXIMUM_RECORDS;
    this.reader = options.reader ?? defaultEvtxEventReader;
  }

  public async parse(input: {
    content: Uint8Array;
    mediaType: string;
    originalFileName: string;
  }): Promise<ParsedLog> {
    if (extensionOf(input.originalFileName) !== '.evtx') {
      throw new TextLogParseError('The uploaded file is not an EVTX export.');
    }

    let temporaryDirectory: string | undefined;

    try {
      temporaryDirectory = await mkdtemp(join(tmpdir(), 'security-log-analyzer-evtx-'));
      const temporaryFilePath = join(temporaryDirectory, 'upload.evtx');
      await writeFile(temporaryFilePath, input.content, { flag: 'wx' });

      const records: SourceRecord[] = [];
      let recordCount = 0;

      for await (const event of this.reader.read(temporaryFilePath)) {
        recordCount += 1;

        if (recordCount > this.maximumRecords) {
          throw new TextLogParseError(
            `The EVTX export exceeds the ${this.maximumRecords}-record processing limit.`,
          );
        }

        records.push(toSourceRecord(event, recordCount));
      }

      return buildParsedLog(records, 0);
    } catch (error: unknown) {
      if (error instanceof TextLogParseError) {
        throw error;
      }

      throw new TextLogParseError('The EVTX export is invalid or contains unsupported records.');
    } finally {
      if (temporaryDirectory !== undefined) {
        await rm(temporaryDirectory, { force: true, recursive: true });
      }
    }
  }
}

const defaultEvtxEventReader: EvtxEventReader = {
  read: (filePath) =>
    readResolvedEvents(filePath, {
      includeDataItems: 'full',
      includeDiagnostics: 'none',
      messageStrategy: 'none',
    }),
};

function toSourceRecord(event: ResolvedEvent, position: number): SourceRecord {
  const dataItems = event.data.items as readonly EvtxDataItem[];
  const eventData = new Map(
    dataItems
      .filter((item) => item.name !== undefined && item.name.trim() !== '')
      .map((item) => [item.name!.toLowerCase(), item.value]),
  );
  const sourceRecord = Number.isSafeInteger(event.id) && event.id > 0 ? event.id : position;

  return {
    __sourceRecord: sourceRecord,
    accountName: eventData.get('accountname'),
    computer: event.computer,
    eventId: event.eventId,
    level: event.levelName ?? levelName(event.level),
    message: event.messageResolution.final?.message ?? fallbackMessage(event),
    provider: event.provider.name,
    subjectUserName: eventData.get('subjectusername'),
    targetUserName: eventData.get('targetusername'),
    timeCreated: event.timestamp,
    user: selectUser(eventData),
    userName: eventData.get('username'),
    workstationName: eventData.get('workstationname'),
  };
}

function extensionOf(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot === -1 ? '' : fileName.slice(lastDot).toLowerCase();
}

function fallbackMessage(event: ResolvedEvent): string {
  const dataItems = event.data.items as readonly EvtxDataItem[];
  const values = dataItems
    .map((item) => (item.name === undefined ? item.value : `${item.name}=${item.value}`))
    .join('; ');

  return values.slice(0, MAXIMUM_FALLBACK_MESSAGE_LENGTH);
}

function levelName(level: number | undefined): string {
  const levels: Readonly<Record<number, string>> = {
    1: 'critical',
    2: 'error',
    3: 'warning',
    4: 'information',
    5: 'verbose',
  };

  return level === undefined ? 'information' : (levels[level] ?? 'information');
}

interface EvtxDataItem {
  readonly name?: string;
  readonly value: string;
}

function selectUser(eventData: ReadonlyMap<string, string>): string | undefined {
  return (
    eventData.get('targetusername') ??
    eventData.get('subjectusername') ??
    eventData.get('username') ??
    eventData.get('accountname')
  );
}
