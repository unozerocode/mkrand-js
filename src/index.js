
exports.rand = rand;
exports.createNonDeterministicStream = createNonDeterministicStream;
exports.createDeterministicStream = createDeterministicStream;
exports.eval_block = eval_block; // For testing

exports.buf_to_psi = buf_to_psi;
exports.psi_to_buf = psi_to_buf;
exports.getBit = getBit;
exports.setBit = setBit;
exports.time_seed = time_seed;
exports.seedUnit = seedUnit;

exports.entropy = entropy;

const { Readable } = require('readable-stream');

const BAD_PSI_FORMAT = "PSI Format is [<:32 hex digits:>]";
const BLOCK_SIZE = 128;  // In bits
let cyclic = 0;


/**
 *  Implements a Readable stream based on a given seed
 *  or generates a time seed when not given one
 *  @param {Buffer} seed 
 *  @returns Stream of bit-packed Buffer
 */
class NonDeterministicStream extends Readable {
    constructor(opt) {
      super(opt);
    }
  
    _read() {
        this.push(rand(time_seed()));
      }
}

function createNonDeterministicStream() {
    return new NonDeterministicStream({});
}

/**
 * Creates a deterministic stream based on the given seed
 * Will run in counter mode from the starting seed
 */
class DeterministicStream extends Readable {
    /**
     * 
     * @param {Object} opt Options for Readable
     * @param {String} seed Starting seed
     * @param {number} size of stream in bytes
     * @returns Readable
     */
    constructor(opt, seed, size) {
      super(opt);
      this.seed = seed;
      this.size = size;
      this.remaining_bytes = size;
      console.log(`Constructed stream with size ${size} and remaining bytes ${this.remaining_bytes}`);
    }

    // Produce an exact number of bytes, used for the fractional part of the request,
    // should never be more than 16
    writeBytes(bytes) {
      let ret = Buffer.alloc(bytes, 0);
      let r = rand(this.seed);
      this.seed = r;
      for (let i = 0; i < bytes; i++){
        ret[i] = r[i];
      }
      this.remaining_bytes -= bytes;
      if (! this.push(ret)) { return} 
      if (this.remaining_bytes == 0) {
        this.push(null);
      }
    }

    writeBlocks(blocks) {
      for (let i = 0; i < blocks; i++) {
        this.seed = rand(this.seed);
        if (! this.push(this.seed)) { return }
        this.remaining_bytes -= (16);
      }
      
      if (this.remaining_bytes == 0) {
        this.push(null);
      }
    }

    /**Calculates how many blocks and remaining byes are needed
     * to fill a request of the given number of bytes
     * Return object with blocks and bytes fields
     * @param {number} bytes 
     * @return {Object} 
     */
    getBlocks_and_bytes(bytes) {
      if (bytes <= 16) {
        return {"blocks": 0, "bytes": bytes}
      } else {
        let num_blocks = Math.floor(bytes / 16);
        let num_bytes = bytes - (num_blocks * 16)
        return {"blocks": num_blocks, "bytes": num_bytes}
      }
    }
  
    _read(requested_bytes) {
       
       // The requested bytes are set by the Node streaming mechanism 
       // Whereas size is set by the client
       // If requested_bytes > size, emit size bytes and then end the stream by writing null
       if (requested_bytes > this.size) {
        let bb = this.getBlocks_and_bytes(this.size == 0 ? requested_bytes : this.size);
        this.writeBlocks(bb.blocks);
        this.writeBytes(bb.bytes);

       } else {  // Requested bytes <= this.size
        
        let bb = this.getBlocks_and_bytes(requested_bytes);

        this.writeBlocks(bb.blocks);
        this.writeBytes(bb.bytes);
       }
       // The other conditions are
       //   if requeted_bytes < size, emit requeseted bytes
       //   if size == 0 always fulfill requested_bytes
       //   if size > 0 then decrement size with every emission
      }
}


function createDeterministicStream( seed, size = 0) {
    return new DeterministicStream({}, seed, size);
}

/**
 * Create a packed buffer with center bit true
 * Canonical seed for testing
 * @return Buffer
 */
function seedUnit() {
    let seed = Buffer.alloc(BLOCK_SIZE / 8,0);
    setBit(seed, (BLOCK_SIZE/2)-1,true);
    return seed;
}

/**
 * Sets or clears bit in a Buffer
 * @param {Buffer} buffer
 * @param {number} bit_num 
 * @param {boolean} value 
 * @return Buffer
 */
function setBit(buffer, bit_num, value){
    let byte_num = (buffer.length - Math.floor(bit_num / 8))-1;
    bit_num = bit_num % 8;
    if (value == false){
      buffer[byte_num] &= ~(1 << bit_num);
    } else {
      buffer[byte_num] |= (1 << bit_num);
    }
    return buffer;
}

/**
 * Reads bit from buffer
 * Big-endian ordering
 * BLOCK_SIZE..0
 * @param {Buffer} buffer 
 * @param {int} bit_num
 * @returns {boolean} bit
 */
function getBit(buffer, bit_num){
    let byte_num = (buffer.length - Math.floor(bit_num / 8))-1;
    bit_num = bit_num % 8;
    return (((buffer[byte_num] >> bit_num) % 2) == 1);
}


/**
 *  Generate a buffer initialized with current time and cyclic variable
 */
function time_seed() {
  let buf = Buffer.alloc(BLOCK_SIZE / 8,0);

  let d = new Date();
  let n = d.getTime(); 
  let base2 = (n).toString(2);

  let start_index = Math.floor(BLOCK_SIZE / 2) - Math.floor(base2.length / 2);
  
  for (let i=0; i<base2.length; i++){
    setBit(buf, start_index + i,  parseInt(base2[i]) == 1);
  }
  
  cyclic = cyclic + 1;
  let cyclic_base2 = (cyclic).toString(2);
  
  for(let i= 0; i < cyclic_base2.length; i++){
      setBit(buf, i, parseInt(cyclic_base2[i]) == 1);
  }

  return buf;
}

/**
 * Calculate entropy of a buffer
 * @param {Buffer} buf 
 * @returns number
 */
function entropy(buf) {
  let bits = buf.length * 8;
  let hamming_weight = 0;
  for (let bit_num=0; bit_num < bits; bit_num++){
   if (getBit(buf, bit_num) == true) {
     hamming_weight += 1;
   }
  }

   // Probability of bit == true
   let prob_1 = hamming_weight / bits;
   // Probability of bit == false
   let prob_0 = 1.0 - prob_1;
   if (prob_1 == 0 || prob_0 == 0) {
       return 0; // No entropy, log goes to infinity so return 0
   }

   let h = 0.0 - ((prob_1 * (Math.log2(prob_1)) + (prob_0 * (Math.log2(prob_0)))))
   return h;
}

/**
 * Convert buffer to PSI Format
 * @param {Buffer} buf 
 * @returns String
 * @throws Error if buffer is not BLOCK_SIZE
 */
function buf_to_psi(buf){
    if (buf.length != BLOCK_SIZE / 8) {
        throw Error(`Block must be of size ${BLOCK_SIZE/8}`);
    }
    let hex = buf.toString("hex").toUpperCase();
    return "[<:" + hex.toUpperCase() + ":>]";
}


/**
 * Create a bbuffer initialized with the given PSI-formatted string
 * @param {String} psi 
 * @returns Buffer
 */
function psi_to_buf(psi){
    let hex_string = psi.slice(3,psi.length-3);
    if (psi.slice(0,3) != "[<:" || psi.slice(psi.length-3, psi.length) != ":>]" || hex_string.length != (BLOCK_SIZE/8)*2) {
        throw Error(BAD_PSI_FORMAT);
    }
    
    let res_buf = Buffer.from(hex_string, "hex");
    return res_buf;
}


/** Generates a random 128-bit block
 * @param {Buffer} seed otherwises creates a time seed
 * @returns Buffer
 */
function rand(seed = time_seed()) {
    //console.log("Starting rand with seed " + buf_to_psi(seed));
    return sha30(seed);
}

/**
 * Evaluates a block based on the given seed
 * @param {Buffer} seed 
 * @returns JSON object with Buffer of last evaluated row, and Buffer of center column 
 */
function eval_block(seed) {
    let center = Buffer.alloc(BLOCK_SIZE / 8, 0);
    let eval_row = seed;
    for (let i = 0; i <= BLOCK_SIZE-1; i++){
        eval_row = eval_rule(eval_row);
        setBit(center, i, getBit(eval_row, BLOCK_SIZE/2-1));
    }
    return {row: eval_row, center: center}
}



/** 
 *  Rule 30 : A XOR (B OR C)
 * 
 *  x(n+1,i) = x(n,i-1) xor [x(n,i) or x(n,i+1)] 
 */
function rule_30(left, middle, right) {
    return ((left ^ ( middle | right)));
}
  
 /**
  * Evaluate a buffer with elemental rule
  * @param {Buffer} source 
  * @returns Buffer
  */
 function eval_rule(source) {
     let dest = Buffer.alloc(BLOCK_SIZE / 8, 0);
    // let row_log = "";
   //  console.log("Eval rule_packed before " + source.toString("hex"));
     for (let col = 0; col <= BLOCK_SIZE-1; col++) {
         let left_cell = (col == BLOCK_SIZE-1)  ? getBit(source, 0) : getBit(source, col+1);
         let right_cell = (col == 0) ? getBit(source, BLOCK_SIZE-1) : getBit(source, col-1);
         let middle_cell = getBit(source, col);
      //   row_log = row_log.concat(rule_30_boolean(left_cell, middle_cell, right_cell) ? "1" : "0");
         setBit(dest, col, rule_30(left_cell, middle_cell, right_cell));
     }
   //  console.log("Eval rule: " + row_log);
   //  console.log("Eval rule_packed after " + dest.toString("hex"));
     return dest;
 }

/**
 * Evaluates two blocks of given buffer, returns center column of second block
 * @param {Buffer} seed 
 * @returns {Buffer}
 */
function sha30(seed) {
    let block = eval_block(seed);
    block = eval_block(block.row);
    return block.center;
}



