import { readFile } from 'node:fs/promises';
import { TextLogParseError } from '@security-log-analyzer/domain';
import { describe, expect, it } from 'vitest';
import { SupportedTextLogParser } from './text-log-parser.js';

const parser = new SupportedTextLogParser();

describe('SupportedTextLogParser', () => {
  it('normalizes line exports and retains physical source record references', async () => {
    const parsed = parser.parse({
      content: await readFixture('sanitized-security-export.log'),
      mediaType: 'text/plain',
      originalFileName: 'sanitized-security-export.log',
    });

    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[0]).toMatchObject({
      eventId: 4624,
      host: 'workstation-01',
      level: 'information',
      provider: 'Security-Auditing',
      sourceRecord: 1,
      user: 'analyst',
    });
    expect(parsed.events[1]?.sourceRecord).toBe(3);
    expect(parsed.summary).toEqual({
      earliestOccurredAt: new Date('2026-07-30T12:00:00Z'),
      eventCount: 2,
      eventsById: { '4624': 1, '4625': 1 },
      eventsByProvider: { 'Security-Auditing': 2 },
      latestOccurredAt: new Date('2026-07-30T12:05:00Z'),
      skippedRecordCount: 1,
    });
  });

  it.each([
    ['sanitized-security-export.csv', 'text/csv'],
    ['sanitized-security-export.json', 'application/json'],
    ['sanitized-security-export.xml', 'application/xml'],
  ])('normalizes the %s structured export', async (fixtureName, mediaType) => {
    const parsed = parser.parse({
      content: await readFixture(fixtureName),
      mediaType,
      originalFileName: fixtureName,
    });

    expect(parsed.events).toHaveLength(2);
    expect(parsed.events.map((event) => event.eventId)).toEqual([4624, 4625]);
    expect(parsed.summary.eventCount).toBe(2);
    expect(parsed.summary.skippedRecordCount).toBe(0);
  });

  it('rejects invalid JSON exports', () => {
    expect(() =>
      parser.parse({
        content: new TextEncoder().encode('{invalid'),
        mediaType: 'application/json',
        originalFileName: 'invalid.json',
      }),
    ).toThrow(TextLogParseError);
  });
});

function readFixture(fileName: string): Promise<Buffer> {
  return readFile(new URL(`../../../tests/fixtures/${fileName}`, import.meta.url));
}
