import type { ResolvedEvent } from '@ts-evtx/core';
import { describe, expect, it } from 'vitest';
import { EvtxLogParser } from './evtx-log-parser.js';
import { SupportedSecurityLogParser } from './security-log-parser.js';

describe('EvtxLogParser', () => {
  it('normalizes streamed EVTX records into the shared Windows event model', async () => {
    const parser = new EvtxLogParser({ reader: readerOf([securityEvent]) });

    const parsed = await parser.parse({
      content: new Uint8Array([1, 2, 3]),
      mediaType: 'application/octet-stream',
      originalFileName: 'Security.evtx',
    });

    expect(parsed.events).toEqual([
      {
        eventId: 4625,
        host: 'workstation-01',
        level: 'warning',
        message: 'TargetUserName=analyst; WorkstationName=workstation-01',
        occurredAt: new Date('2026-07-30T12:05:00.000Z'),
        provider: 'Microsoft-Windows-Security-Auditing',
        sourceRecord: 17,
        user: 'analyst',
      },
    ]);
    expect(parsed.summary.eventsById).toEqual({ '4625': 1 });
  });

  it('enforces the configured processing record limit', async () => {
    const parser = new EvtxLogParser({
      maximumRecords: 1,
      reader: readerOf([securityEvent, securityEvent]),
    });

    await expect(
      parser.parse({
        content: new Uint8Array([1]),
        mediaType: 'application/octet-stream',
        originalFileName: 'Security.evtx',
      }),
    ).rejects.toThrow('1-record processing limit');
  });
});

describe('SupportedSecurityLogParser', () => {
  it('dispatches EVTX files to the EVTX adapter and other files to the text adapter', async () => {
    const calls: string[] = [];
    const parser = new SupportedSecurityLogParser(
      { parse: async () => ({ events: [], summary: emptySummary }) },
      { parse: async () => ({ events: [], summary: emptySummary }) },
    );
    const textParser = {
      parse: async () => {
        calls.push('text');
        return { events: [], summary: emptySummary };
      },
    };
    const evtxParser = {
      parse: async () => {
        calls.push('evtx');
        return { events: [], summary: emptySummary };
      },
    };
    const dispatchingParser = new SupportedSecurityLogParser(textParser, evtxParser);

    await dispatchingParser.parse({
      content: new Uint8Array([1]),
      mediaType: 'application/octet-stream',
      originalFileName: 'Security.evtx',
    });
    await dispatchingParser.parse({
      content: new Uint8Array([1]),
      mediaType: 'text/plain',
      originalFileName: 'Security.log',
    });

    expect(parser).toBeDefined();
    expect(calls).toEqual(['evtx', 'text']);
  });
});

function readerOf(events: readonly ResolvedEvent[]) {
  return {
    async *read(): AsyncIterable<ResolvedEvent> {
      yield* events;
    },
  };
}

const emptySummary = {
  earliestOccurredAt: undefined,
  eventCount: 0,
  eventsById: {},
  eventsByProvider: {},
  latestOccurredAt: undefined,
  skippedRecordCount: 0,
};

const securityEvent = {
  data: {
    fieldCount: 2,
    items: [
      { name: 'TargetUserName', value: 'analyst' },
      { name: 'WorkstationName', value: 'workstation-01' },
    ],
    source: 'EventData',
  },
  eventId: 4625,
  id: 17,
  level: 3,
  levelName: 'Warning',
  messageResolution: {
    attempts: [],
    fallback: {
      builtFrom: 'EventData',
      itemCount: 2,
      message: 'TargetUserName=analyst; WorkstationName=workstation-01',
    },
    status: 'fallback',
  },
  provider: { name: 'Microsoft-Windows-Security-Auditing' },
  timestamp: '2026-07-30T12:05:00.000Z',
  computer: 'workstation-01',
} satisfies ResolvedEvent;
