import type { LogParser, ParsedLog } from '@security-log-analyzer/domain';
import { EvtxLogParser } from './evtx-log-parser.js';
import { SupportedTextLogParser } from './text-log-parser.js';

export class SupportedSecurityLogParser implements LogParser {
  public constructor(
    private readonly textParser: LogParser = new SupportedTextLogParser(),
    private readonly evtxParser: LogParser = new EvtxLogParser(),
  ) {}

  public parse(input: {
    content: Uint8Array;
    mediaType: string;
    originalFileName: string;
  }): Promise<ParsedLog> {
    return extensionOf(input.originalFileName) === '.evtx'
      ? this.evtxParser.parse(input)
      : this.textParser.parse(input);
  }
}

function extensionOf(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot === -1 ? '' : fileName.slice(lastDot).toLowerCase();
}
