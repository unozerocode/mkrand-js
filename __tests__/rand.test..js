const assert = require("assert");
const  {rand: rand, createDeterministicStream, eval_block, seedUnit, 
   buf_to_psi, psi_to_buf, getBit: getBit, setBit, entropy, time_seed} = require("../src/index");

   var fs = require("fs");

function wait_for_stream_end_promise(stream, num_bytes) {
  let remaining_bytes = num_bytes;
  return new Promise ((resolve, reject) => {
    stream.on("data", () => {
      remaining_bytes--;
      if (remaining_bytes == 0) { 
        resolve() }
      if (remaining_bytes < 0) { reject(`remaining bytes went negative: ${remaining_bytes}`)}
    })
    stream.on("end", () => {
      resolve();
    });
    stream.on("error", error => reject(error));
  });
}

function wait_for_file_end_promise(stream) {
  return new Promise((resolve, reject) => {
    stream.on("finish", () => {
      resolve();
    });
    stream.on("error", (e) => {
      reject(e);
    })
  })
}

describe('MKRand', () => {
  describe('rand', () => {
    it("Rand should return a 16 byte buffer", () => {
      let r = rand();
      assert.equal(r.length, 16);
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
      // Create a buffer of 100 blocks and check its entropy
      let bufA = Buffer.alloc(1600, 0);
      assert.equal(entropy(bufA), 0);
      let blocks = [];
      for (let i = 0; i<100; i++) {
        blocks[i] = rand();
      }
      
      let bufConcat = Buffer.concat(blocks);
      let h = entropy(bufConcat);
      console.log(`Entropy of blocks: ${h}`);
      assert.equal(h >= 0.99, true);
    }),

    it("should produce a stream", () => {
      let ds = createDeterministicStream(seedUnit(),16);
      let rchunk = ds.read(16);
      let chunk_hex = rchunk.toString("hex");
      assert.equal(chunk_hex,"3644030f6742c602abe9f8a6c8cd391b");  // check with cryptol
    }),

    it("should produce a 1KB file", async () => {
      const TEST_FILE = "./test.bin"
      let num_bytes = 1000;
      let ds = createDeterministicStream(seedUnit(),num_bytes);
      let ws = fs.createWriteStream(TEST_FILE);
      ds.pipe(ws);

      await wait_for_stream_end_promise(ds, num_bytes);
      await wait_for_file_end_promise(ws);
      var stats = fs.statSync(TEST_FILE);
      var fileSizeInBytes = stats.size;
      assert.equal(fileSizeInBytes, num_bytes);
      // check its entropy
      fs.readFile(TEST_FILE, function (err, data) {
        assert(entropy(data) > 0.99);
      });
     
    }),

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