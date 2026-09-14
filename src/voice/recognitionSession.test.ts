import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRecognitionMachine } from './recognitionSession';

describe('recognition session machine', () => {
  it('issues a new sessionId on begin and ignores stale callbacks', () => {
    const machine = createRecognitionMachine();
    const first = machine.begin();
    assert.ok(first > 0);
    assert.equal(machine.snapshot().state, 'PREPARING');
    assert.equal(machine.transition(first, 'LISTENING'), true);
    const second = machine.begin();
    assert.equal(second, 0);
    assert.equal(machine.shouldIgnoreCallback(first - 1), true);
    assert.equal(machine.shouldIgnoreCallback(first), false);
  });

  it('blocks double start while busy', () => {
    const machine = createRecognitionMachine();
    assert.ok(machine.begin() > 0);
    assert.equal(machine.canStart(), false);
    assert.equal(machine.isBusy(), true);
    assert.equal(machine.begin(), 0);
  });

  it('does not request abort on the success path', () => {
    const machine = createRecognitionMachine();
    const id = machine.begin();
    assert.ok(machine.transition(id, 'LISTENING'));
    assert.ok(machine.transition(id, 'PROCESSING'));
    assert.ok(machine.transition(id, 'SAVING'));
    assert.ok(machine.finish(id, 'SUCCESS'));
    assert.equal(machine.snapshot().state, 'SUCCESS');
    assert.equal(machine.snapshot().abortRequested, false);
    assert.equal(machine.requestAbort(id), false);
  });

  it('allows abort only for cancel / recovery while a session is live', () => {
    const machine = createRecognitionMachine();
    const id = machine.begin();
    assert.equal(machine.requestAbort(id), true);
    assert.equal(machine.snapshot().abortRequested, true);
    assert.ok(machine.finish(id, 'ERROR'));
    machine.reset();
    assert.equal(machine.snapshot().state, 'IDLE');
    assert.equal(machine.requestAbort(id), false);
  });

  it('can start again after SUCCESS or ERROR', () => {
    const machine = createRecognitionMachine();
    const first = machine.begin();
    machine.transition(first, 'LISTENING');
    machine.transition(first, 'PROCESSING');
    machine.finish(first, 'SUCCESS');
    const second = machine.begin();
    assert.ok(second > first);
    assert.equal(machine.shouldIgnoreCallback(first), true);
  });
});
