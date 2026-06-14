import { describe, it, expect } from 'vitest';
import { csvCell, csvRow, parseCsvRows } from '../lib/csv';

describe('csvCell', () => {
  it('passes through plain strings', () => expect(csvCell('hello')).toBe('hello'));
  it('wraps strings containing commas in quotes', () => expect(csvCell('a,b')).toBe('"a,b"'));
  it('wraps strings containing newlines in quotes', () => expect(csvCell('a\nb')).toBe('"a\nb"'));
  it('escapes internal double-quotes', () => expect(csvCell('say "hi"')).toBe('"say ""hi"""'));
  it('returns empty string for null', () => expect(csvCell(null)).toBe(''));
  it('returns empty string for undefined', () => expect(csvCell(undefined)).toBe(''));
  it('converts numbers to string', () => expect(csvCell(42)).toBe('42'));
  it('converts zero to string', () => expect(csvCell(0)).toBe('0'));
});

describe('csvRow', () => {
  it('joins cells with commas', () => expect(csvRow(['a', 'b', 'c'])).toBe('a,b,c'));
  it('quotes cells that need it', () => expect(csvRow(['a,b', 'c'])).toBe('"a,b",c'));
  it('handles nulls in row', () => expect(csvRow(['a', null, 'c'])).toBe('a,,c'));
});

describe('parseCsvRows', () => {
  it('parses simple rows', () => {
    expect(parseCsvRows('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('handles quoted fields with internal commas', () => {
    expect(parseCsvRows('Item,"a,b",Notes')).toEqual([['Item', 'a,b', 'Notes']]);
  });

  it('handles double-quoted quotes inside fields', () => {
    expect(parseCsvRows('"say ""hi"""')).toEqual([['say "hi"']]);
  });

  it('skips empty lines', () => {
    expect(parseCsvRows('a,b\n\nc,d\n')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('handles Windows CRLF line endings', () => {
    expect(parseCsvRows('a,b\r\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('handles quoted line breaks inside cells', () => {
    expect(parseCsvRows('Name,Notes\nA,"line 1\nline 2"\nB,done')).toEqual([
      ['Name', 'Notes'],
      ['A', 'line 1\nline 2'],
      ['B', 'done'],
    ]);
  });

  it('round-trips a row through csvRow + parseCsvRows', () => {
    const original = ['Alpha Crucis', 'Electronics, Advanced', '100000', 'Buy at Roup'];
    const line = csvRow(original);
    const parsed = parseCsvRows(line);
    expect(parsed[0]).toEqual(original);
  });
});
