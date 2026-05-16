/*
 * Strict RFC 4180 CSV parser used by the `game-movement-export` feature's
 * property and round-trip tests. The parser is a small state machine over the
 * input string and supports:
 *
 *   - unquoted fields (any character except `,`, `"`, `\r`, `\n`)
 *   - quoted fields wrapped in `"`, with `""` representing a literal `"`
 *     and any of `,`, `\r`, `\n`, `\r\n` permitted inside the quoted body
 *   - row terminators of either CRLF (`\r\n`) or LF (`\n`)
 *   - a single trailing terminator after the final row, which is consumed
 *     without producing an extra empty row
 *   - the empty input string, which produces `[]`
 *
 * Malformed inputs raise an `Error` with a message naming the offending
 * position. Specifically the parser throws on:
 *
 *   - an unterminated quoted field (EOF reached while still inside `"..."`)
 *   - a stray `"` appearing inside an unquoted field
 *   - any character other than `,`, `\r`, `\n`, or another `"` immediately
 *     following the closing `"` of a quoted field
 *
 * The implementation is pure, has no third-party dependency, and performs no
 * I/O. It exists solely so the movement-export property tests can assert
 * round-trip correctness of `CsvFormatter` against a strict RFC 4180 baseline
 * without pulling in an external CSV library.
 */

type ParserMode = 'startOfRow' | 'startOfField' | 'unquoted' | 'quoted' | 'afterClosingQuote';

export function parseCsvRfc4180(input: string): string[][] {
    if (input.length === 0) {
        return [];
    }

    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let mode: ParserMode = 'startOfRow';
    let i = 0;
    const len = input.length;

    while (i < len) {
        const c = input[i];

        switch (mode) {
            case 'startOfRow':
            case 'startOfField': {
                if (c === '"') {
                    mode = 'quoted';
                    i++;
                } else if (c === ',') {
                    row.push('');
                    mode = 'startOfField';
                    i++;
                } else if (c === '\r' || c === '\n') {
                    // A terminator at `startOfField` closes a trailing empty
                    // field (e.g. the input `a,\n` has two fields). A
                    // terminator at `startOfRow` is either a leading blank
                    // line or the trailing terminator after the previous
                    // row; in both cases we drop it rather than emit `['']`.
                    if (mode === 'startOfField') {
                        row.push('');
                        rows.push(row);
                        row = [];
                    }
                    if (c === '\r' && i + 1 < len && input[i + 1] === '\n') {
                        i += 2;
                    } else {
                        i++;
                    }
                    mode = 'startOfRow';
                } else {
                    field = c;
                    mode = 'unquoted';
                    i++;
                }
                break;
            }
            case 'unquoted': {
                if (c === ',') {
                    row.push(field);
                    field = '';
                    mode = 'startOfField';
                    i++;
                } else if (c === '\r' || c === '\n') {
                    row.push(field);
                    field = '';
                    rows.push(row);
                    row = [];
                    if (c === '\r' && i + 1 < len && input[i + 1] === '\n') {
                        i += 2;
                    } else {
                        i++;
                    }
                    mode = 'startOfRow';
                } else if (c === '"') {
                    throw new Error(
                        `parseCsvRfc4180: unexpected '"' inside unquoted field at index ${i}`
                    );
                } else {
                    field += c;
                    i++;
                }
                break;
            }
            case 'quoted': {
                if (c === '"') {
                    mode = 'afterClosingQuote';
                    i++;
                } else {
                    field += c;
                    i++;
                }
                break;
            }
            case 'afterClosingQuote': {
                if (c === '"') {
                    // Doubled quote inside a quoted field: emit a literal `"`
                    // and resume reading the quoted body.
                    field += '"';
                    mode = 'quoted';
                    i++;
                } else if (c === ',') {
                    row.push(field);
                    field = '';
                    mode = 'startOfField';
                    i++;
                } else if (c === '\r' || c === '\n') {
                    row.push(field);
                    field = '';
                    rows.push(row);
                    row = [];
                    if (c === '\r' && i + 1 < len && input[i + 1] === '\n') {
                        i += 2;
                    } else {
                        i++;
                    }
                    mode = 'startOfRow';
                } else {
                    throw new Error(
                        `parseCsvRfc4180: unexpected character ${JSON.stringify(c)} after closing quote at index ${i}`
                    );
                }
                break;
            }
        }
    }

    // Flush any in-progress field/row at end-of-input.
    switch (mode) {
        case 'quoted':
            throw new Error('parseCsvRfc4180: unterminated quoted field at end of input');
        case 'startOfRow':
            // Clean end: the previous row terminator was consumed and no new
            // row was started. Nothing to flush.
            break;
        case 'startOfField':
            // Input ended with a comma (e.g. `a,`): push the trailing empty
            // field and finalize the row.
            row.push('');
            rows.push(row);
            break;
        case 'unquoted':
        case 'afterClosingQuote':
            row.push(field);
            rows.push(row);
            break;
    }

    return rows;
}
