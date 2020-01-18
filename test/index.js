import assert from 'assert';
import {rand} from "../src/index";

describe('MKRand', () => {
  describe('rand', () => {
    it('should return 32 hex digits', () => {
      let r = rand();
      assert.equal(r.valid, true);
      assert.equal(r.data.length, 32);
      let regexp = /^[0-9a-fA-F]+$/;
      assert.equal(regexp.test(r.data), true);
    });
  });
});