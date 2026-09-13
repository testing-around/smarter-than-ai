import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatVoiceError, mapRecognitionError } from './mapRecognitionError';

describe('mapRecognitionError', () => {
  it('never surfaces the bare native aborted string', () => {
    const mapped = mapRecognitionError('aborted', 'Speech recognition aborted.');
    assert.notEqual(mapped.message, 'Speech recognition aborted.');
    assert.ok(!formatVoiceError(mapped).includes('Speech recognition aborted.'));
    assert.ok(mapped.recover.includes('retry'));
    assert.ok(mapped.recover.includes('tap-only'));
  });

  it('maps the raw aborted message even without a code', () => {
    const mapped = mapRecognitionError(undefined, 'Speech recognition aborted.');
    assert.equal(mapped.code, 'aborted');
    assert.ok(mapped.recover.includes('diagnostics'));
  });
});
