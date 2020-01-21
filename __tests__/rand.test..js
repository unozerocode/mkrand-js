const assert = require("assert");
const  {rand: rand, createBinaryReadStream, eval_block, seedUnit, seedUnit_psi, 
   buf_to_psi, psi_to_buf, getBit: getBit, setBit, entropy, time_seed} = require("../src/index");

describe('MKRand', () => {
  describe('rand', () => {
    it("Rand_packed should return a 16 byte buffer", () => {
      let r = rand();
      assert.equal(r.length, 16);
      console.log("Rand generated " + r.toString("hex"));
      console.log(`Entropy of r: ${entropy(r)}`);
    }),

    it("getBit", () => {
      let test_buf = Buffer.alloc(16,0xFF);
      for (let bit_num = 0; bit_num <= 127; bit_num++){
        assert.equal(getBit(test_buf, bit_num), true);
      }
      let test_buf2 = Buffer.alloc(1,0);
      for (let bit_num = 0; bit_num <= 7; bit_num++) {
        assert.equal(getBit(test_buf2, bit_num), false);
      }
      test_buf2[0] = 0x80;
      assert.equal(getBit(test_buf2, 7), true);
      assert.equal(getBit(test_buf2, 6), false);
      assert.equal(getBit(test_buf2, 5), false);
      assert.equal(getBit(test_buf2, 4), false);
      assert.equal(getBit(test_buf2, 3), false);
      assert.equal(getBit(test_buf2, 2), false);
      assert.equal(getBit(test_buf2, 1), false);
      assert.equal(getBit(test_buf2, 0), false);
    }),

    it("buf_to_psi", () => {
      let test_buf = Buffer.alloc(16,0x00);
      assert.equal(buf_to_psi(test_buf), "[<:00000000000000000000000000000000:>]");
      test_buf = Buffer.alloc(16,0xFF);
      assert.equal(buf_to_psi(test_buf), "[<:FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:>]");
    }),

    it("psi to buffer", () => {
      let buf_a = psi_to_buf("[<:FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:>]");
      let buf_b = Buffer.alloc(16,0xFF);
      assert.equal(buf_a.compare(buf_b),0);
      console.log(`Entropy ${entropy(buf_a)}`);
    }),

    it("setBit", () => {
      let test_buf = Buffer.alloc(16, 0x00);
      for (let i=0; i <= 127; i++) {
        setBit(test_buf, i, true);
        assert.equal(getBit(test_buf,i),true);
        setBit(test_buf, i, false);
        assert.equal(getBit(test_buf, i), false);
      }
    }),

    it("time seed", () => {
      let ts1 = time_seed();
      let ts2 = time_seed();
      assert.equal(ts1.compare(ts2) == 0, false);
      assert.equal(ts1.length, 16);
      assert.equal(ts2.length, 16);
      console.log(`Entropy of time seed ${entropy(ts1)}`);
    }),

    it("Entropy calculation", () => {
      let bufA = Buffer.alloc(16, 0);
      assert.equal(entropy(bufA), 0);
      let r = rand();
      assert.equal(entropy(r) >= 0.99, true);
    }),
/*
    it("should produce a stream", () => {
      let rs = createBinaryReadStream(seedUnit());
      let rchunk = rs.read(16);
      let chunk_hex = "";
      for (const value of rchunk.values()) {
        chunk_hex += (value.toString(16));
      }
      assert.equal(chunk_hex,"0f8ff00f8ff00f8ff00f8ff0");  // check with cryptol
    }),
*/
    it("evalblock(seedUnit) should return 101110011000101100100..", () => {
      let eb = eval_block(seedUnit());

      assert.equal(getBit(eb.center,0), true);
      assert.equal(getBit(eb.center,1), false);

      assert.equal(getBit(eb.center,2), true);
      assert.equal(getBit(eb.center,3), true);
      assert.equal(getBit(eb.center,4), true);
      
      assert.equal(getBit(eb.center,5), false);
      assert.equal(getBit(eb.center,6), false);

      assert.equal(getBit(eb.center,7), true);
      assert.equal(getBit(eb.center,8), true);

      assert.equal(getBit(eb.center,9), false);
      assert.equal(getBit(eb.center,10), false);
      assert.equal(getBit(eb.center,11), false);
    })
  });
    
});