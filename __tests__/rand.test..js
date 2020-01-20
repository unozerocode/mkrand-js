const assert = require("assert");
const  {rand, createBinaryReadStream, eval_block, seedUnit_psi, seedUnit_binary_unpacked, bit_pack} = require("../src/index");

describe('MKRand', () => {
  describe('rand', () => {
    it('should return 32 hex digits', () => {
      let r = rand();
      assert.equal(r.length, 32);
      let regexp = /^[0-9a-fA-F]+$/;
      assert.equal(regexp.test(r), true);
      
    }),

    it("should thoww exception on bad PSI format", () => {
      try {
        r = rand("deadbeef");
      } catch (e) {
        assert.equal(e.message, "PSI Format is [<:32 hex digits:>]")
      }
    }),

    it("bitpack", () => {
      let test_buf = Buffer.alloc(128,1);  // Unpacked 128 byte buffer
      let packed_buf = bit_pack(test_buf);
      assert.equal(packed_buf.length, 16);
      assert.equal(packed_buf[0], 0xFF);
      assert.equal(packed_buf[1], 0xFF);
      assert.equal(packed_buf[2], 0xFF);
      assert.equal(packed_buf[3], 0xFF);
      assert.equal(packed_buf[4], 0xFF);
      assert.equal(packed_buf[5], 0xFF);
      assert.equal(packed_buf[6], 0xFF);
      assert.equal(packed_buf[7], 0xFF);
    }),

    it("should produce a stream", () => {
      let rs = createBinaryReadStream(seedUnit_psi());
      let rchunk = rs.read(16);
      let chunk_hex = "";
      for (const value of rchunk.values()) {
        chunk_hex += (value.toString(16));
      }
      assert.equal(chunk_hex,"0f8ff00f8ff00f8ff00f8ff0");  // check with cryptol
    }),

    it("evalblock(seedUnit) should return 101110011000101100100..", () => {
      let eb = eval_block(seedUnit_binary_unpacked());

      assert.equal(eb.center[0], 1);
      assert.equal(eb.center[1], 0);

      assert.equal(eb.center[2], 1);
      assert.equal(eb.center[3], 1);
      assert.equal(eb.center[4], 1);
      
      assert.equal(eb.center[5], 0);
      assert.equal(eb.center[6], 0);

      assert.equal(eb.center[7], 1);
      assert.equal(eb.center[8], 1);

      assert.equal(eb.center[9], 0);
      assert.equal(eb.center[10], 0);
      assert.equal(eb.center[11], 0);
    })
  });
    
});