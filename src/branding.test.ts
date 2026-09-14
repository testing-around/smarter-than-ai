import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APP_NAME, APP_NAME_SHORT, APP_PACKAGE_ID, APP_TAGLINE, brandEnrollmentLine } from './branding';

describe('branding', () => {
  it('uses THEN, not THAN', () => {
    assert.equal(APP_NAME, 'Smarter Then AI');
    assert.equal(APP_NAME_SHORT, 'SMARTER THEN AI');
    assert.equal(APP_TAGLINE.includes('Then'), true);
    assert.equal(/than/i.test(APP_NAME), false);
    assert.equal(/than/i.test(APP_NAME_SHORT), false);
  });

  it('keeps the existing Android package id', () => {
    assert.equal(APP_PACKAGE_ID, 'com.smarterthanai.game');
  });

  it('brands enrollment copy', () => {
    assert.match(brandEnrollmentLine('Damian'), /Smarter Then AI/);
    assert.equal(/than/i.test(brandEnrollmentLine('Damian')), false);
  });
});
