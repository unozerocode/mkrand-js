
exports.rand = rand;
exports.createBinaryReadStream = createBinaryReadStream;
exports.eval_block = eval_block; // For testing
exports.getBit = getBit; // For testing
exports.buf_to_psi = buf_to_psi;
exports.psi_to_buf = psi_to_buf;
exports.getBit = getBit;
exports.setBit = setBit;
exports.time_seed = time_seed;
exports.seedUnit = seedUnit;

exports.entropy = entropy;

const { Readable } = require('stream');

const BAD_PSI_FORMAT = "PSI Format is [<:32 hex digits:>]";
const BLOCK_SIZE = 128;  // In bits
let cyclic = 0;

// TODO use packed buffer throughout, and use Buffer.from(s,"hex") to convert from string

/**
 *  Implements a Readable stream based on a given seed
 *  or generates a time seed when not given one
 *  @param {Buffer} seed 
 *  @returns Stream of bit-packed Buffer
 */
function createBinaryReadStream(seed) {
    const read_stream = new Readable({
        read(size) {
            let num_blocks = Math.ceil(size / 16);
            
            for (let i=0; i< num_blocks; i++){
              this.push(rand(seed));
            }
        }
    })
   return read_stream;
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
    if(value == false){
      buffer[byte_num] &= ~(1 << bit_num);
    }else{
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
 *  Generate a buffer initialized with current time
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
 */
function buf_to_psi(buf){
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
 * @returns String
 */
function rand(seed = time_seed()) {
    console.log("Starting rand_packed with seed " + seed.toString("hex"));
    return sha30(seed);
}

/**
 * Evaluates a block based on the given seed
 * @param {String} seed 
 * @returns JSON object .row: Buffer of last evaluated row , .center: Buffer of center column unpacked
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
 * Boolean XOR
 * @param {Boolean} left 
 * @param {Boolean} right
 * @returns Boolean 
 */
function bxor(left, right) {
    if (((left == true) && (right == false)) ||
       ((left == false) && (right == true))) {
           return (true);
       } else {
           return (false);
       }
}

/**
 * Boolean or
 * @param {*} left 
 * @param {*} right 
 * @returns Boolean
 */
function bor(left, right) {
    if ((left == true) || (right == true)) {
        return (true)
    } else {
        return (false)
    }
}


/** 
 *  Rule 30 : A XOR (B OR C)
 * 
 *  x(n+1,i) = x(n,i-1) xor [x(n,i) or x(n,i+1)] 
 */
function rule_30_boolean(left, middle, right) {
    return (bxor (left, bor( middle, right)));
}
  
 
 function eval_rule(source) {
     let dest = Buffer.alloc(BLOCK_SIZE / 8, 0);
    // let row_log = "";
   //  console.log("Eval rule_packed before " + source.toString("hex"));
     for (let col = 0; col <= BLOCK_SIZE-1; col++) {
         let left_cell = (col == BLOCK_SIZE-1)  ? getBit(source, 0) : getBit(source, col+1);
         let right_cell = (col == 0) ? getBit(source, BLOCK_SIZE-1) : getBit(source, col-1);
         let middle_cell = getBit(source, col);
      //   row_log = row_log.concat(rule_30_boolean(left_cell, middle_cell, right_cell) ? "1" : "0");
         setBit(dest, col, rule_30_boolean(left_cell, middle_cell, right_cell));
     }
   //  console.log("Eval rule: " + row_log);
   //  console.log("Eval rule_packed after " + dest.toString("hex"));
     return dest;
 }


function sha30(seed) {
    let block = eval_block(seed);
    block = eval_block(block.row);
    return block.center;
}



