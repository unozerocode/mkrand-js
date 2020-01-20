exports.rand = rand; 
exports.psi_to_binary = psi_to_binary_string;
exports.createBinaryReadStream = createBinaryReadStream;
exports.eval_block = eval_block; // For testing
exports.bit_pack = bit_pack; // For testing
exports.seedUnit_psi = seedUnit_psi; // For testing
exports.seedUnit_binary_unpacked = seedUnit_binary_unpacked;

const { Readable } = require('stream');

const BAD_PSI_FORMAT = "PSI Format is [<:32 hex digits:>]";
const BLOCK_SIZE = 128;
let cyclic = 0;


/**
 *  Implements a Readable stream based on a given seed
 *  or generates a time seed when not given one
 *  @param {string} seed 
 *  @returns Stream of bit-packed Buffer
 */
function createBinaryReadStream(seed) {
    const read_stream = new Readable({
        read(size) {
            let num_blocks = Math.ceil(size / 16);
            for (let i=0; i< num_blocks; i++){
              this.push(bit_pack(rand(seed)));
            }
        }
    })
   return read_stream;
}




/**
 *  Creates an unpacked binary Buffer with a 1 at the center and 0 every other cell
 *  Used for testing or when generating the canonical sequence
 *  @returns Buffer
 */
function seedUnit_binary_unpacked() {
    let row = Buffer.alloc(BLOCK_SIZE, 0);
    row[(BLOCK_SIZE/2)-1] = 1;
    return row;
}

/**
 *  Creates Unit seed in PSI format
 *  1 at the center and 0 every other cell
 *  Used for testing or when generating the canonical sequence
 */
function seedUnit_psi() {
    return binary_unpacked_to_psi(seedUnit_binary_unpacked());
}


/**
 *  Generates a binary Buffer initialized with the current time
 *  plus an incrementing cyclic number
 *  @returns Buffer
 */
function time_seed_binary_unpacked() {
    let row = Buffer.alloc(BLOCK_SIZE,0);
    let d = new Date();
    let n = d.getTime(); 
    let base2 = (n).toString(2);

    let start_index = ~~(BLOCK_SIZE / 2) - ~~(base2.length / 2);
    
    for (let i=0; i<base2.length; i++){
      row[start_index + i] = parseInt(base2[i]);
    }
    
    cyclic = cyclic + 1;
    let cyclic_base2 = (cyclic).toString(2);
    let cyclic_start_index = BLOCK_SIZE - cyclic_base2.length;
    
    for(let i= 0; i < cyclic_base2.length; i++){
        row[cyclic_start_index + i] = parseInt(cyclic_base2[i]);
    }
 
    return row;
}

/**
 * Packs bits from 1 bit per byte unpacked to 1 bit per bit
 * @param {Buffer} buf 
 * @returns Buffer
 */
function bit_pack(buf) {
  let rb = Buffer.alloc(buf.length/8);

  for (let cur_byte = 0; cur_byte <= buf.length; cur_byte++){
    for (let bit = 0; bit <= 7; bit++){
      rb[cur_byte] = rb[cur_byte] | (buf[cur_byte] << bit)
    }
  }
  return rb;
}

/**
 *  Convert unpacked binary buffer to PSI Format 
 *  @param {Buffer} buf
 *  @returns string in PSI format
 */
function binary_unpacked_to_psi(buf) {
   let hex = binary_string_to_hex(buf.join(""));
    return "[<:" + hex + ":>]";
}


/**
 * Converts a PSI formattted string to a binary string
 * @param {string} psi 
 * @throws Error on bad PSI format
 */
function psi_to_binary_string(psi) {

    if (psi.length == 38 && (psi.slice(0,3) == "[<:") && (psi.slice(35,38) == ":>]")) {
        let hex = psi.slice(3,35);

        return hexToBinaryString(hex);
        
    } else {
        throw Error(BAD_PSI_FORMAT);
    }
}

/**
 * Converts PSI formatted string to an unpack binary Buffer
 * @param {String} psi 
 * @returns 128-byte Buffer of 0 and 1
 */
function psi_to_binary_buffer(psi) {
    let binary_string = psi_to_binary_string(psi);
    let res_buf = Buffer.alloc(BLOCK_SIZE,0);
      for (let i=0; i < binary_string.length; i++) {
          res_buf[i] = parseInt(binary_string.slice(i,i+1));
      }
     return res_buf;
}

/** Generates a random 128-bit block
 * @param {String} seed in PSI format, otherwises creates a time seed
 * @returns String
 */
function rand(seed = binary_unpacked_to_psi(time_seed_binary_unpacked())) {
    return binary_string_to_hex(sha30(psi_to_binary_buffer(seed)).join(""));
}

/**
 * Evaluates a block based on the given seed
 * @param {String} seed 
 * @returns JSON object .row: Buffer of last evaluated row , .center: Buffer of center column unpacked
 */
function eval_block(seed) {
    let ret = seed;
    let center = Buffer.alloc(BLOCK_SIZE,0);
    for(let i = 0; i <= BLOCK_SIZE-1; i++) {
        ret = eval_rule(ret);
        center[i] = (ret[BLOCK_SIZE/2-1]);
    }
    return {row: ret, center: center};
}

/* OR */
function cor ( left,  right)
{
   if ((left == null) || (right == null)) {
      return (null);
   } else {
      if ((left == 1) || (right == 1)) {
         return (1);
      } else {
         return (0);
      }
   }
}


/**
   Performs XOR operation 
**/
function cxor ( left,  right)
{
   if ((left == null) || (right == null)) {
      return (null);
   } else {
      if (((left == 1)  && (right == 0)) ||
          ((left == 0)  && (right == 1))) {
         return (1);
      } else {
         return (0);
      }
   }
}


/** 
 *  Rule 30 : A XOR (B OR C)
 * 
 *  x(n+1,i) = x(n,i-1) xor [x(n,i) or x(n,i+1)] 
 */
function rule_30( left,  middle,  right){
    return (cxor (left, cor (middle, right)));
  }
  

/** Evaluate source vector with elemental rule
 *  @param {Buffer source} unpacked binary Buffer of length 128
 */
function eval_rule(source){
    let dest = Buffer.alloc(BLOCK_SIZE,0);

    for (let col = 0; col <= BLOCK_SIZE-1; col++){
    
       let left_cell   = (col == 0) ? source[BLOCK_SIZE-1]   : source[col-1];
       let right_cell  = (col == BLOCK_SIZE-1) ? source[0]   : source[col+1]; 
       let middle_cell = source[col];
   
       dest[col] = rule_30(left_cell, middle_cell, right_cell);  

    }  
    return dest;
 }

 /**  Use the input segment as the seed, generate two square fields,
 *    keep the center column of the second.
 *    @param {string} seed in PSI Format
 */
function sha30 (seed) {
    let block = eval_block(seed)
    block = eval_block(block.row)
    return block.center;
}

/**
 * Convert Binary string to hexadecimal
 * @param {string} s String of 0 and 1
 * @throws Error on bad format
 */
function binary_string_to_hex(s) {
    let i, part, accum, ret = '';
    for (i = s.length-1; i >= 3; i -= 4) {
        // extract out in substrings of 4 and convert to hex
        part = s.substr(i+1-4, 4);
        accum = 0;
        for (let k = 0; k < 4; k += 1) {
            if (part[k] !== '0' && part[k] !== '1') {
                // invalid character
                throw new Error(`Found invalid character ${part[k]} at index ${k}`)
            }
            // compute the length 4 substring
            accum = accum * 2 + parseInt(part[k], 10);
        }
        if (accum >= 10) {
            // 'A' to 'F'
            ret = String.fromCharCode(accum - 10 + 'A'.charCodeAt(0)) + ret;
        } else {
            // '0' to '9'
            ret = String(accum) + ret;
        }
    }
    // remaining characters, i = 0, 1, or 2
    if (i >= 0) {
        accum = 0;
        // convert from front
        for (let k = 0; k <= i; k += 1) {
            if (s[k] !== '0' && s[k] !== '1') {
                throw new Error(`Expecting 0 or 1 at position ${k}`)
            }
            accum = accum * 2 + parseInt(s[k], 10);
        }
        // 3 bits, value cannot exceed 2^3 - 1 = 7, just convert
        ret = String(accum) + ret;
    }
    return ret;
}

/**
 * Converts hexadecimal to binary string
 * @param {string} s hexadecimal formatted string
 * @returns {string}
 */
function hexToBinaryString(s) {
    let   ret = '';
    // lookup table for easier conversion. '0' characters are padded for '1' to '7'
    let lookupTable = {
        '0': '0000', '1': '0001', '2': '0010', '3': '0011', '4': '0100',
        '5': '0101', '6': '0110', '7': '0111', '8': '1000', '9': '1001',
        'a': '1010', 'b': '1011', 'c': '1100', 'd': '1101',
        'e': '1110', 'f': '1111',
        'A': '1010', 'B': '1011', 'C': '1100', 'D': '1101',
        'E': '1110', 'F': '1111'
    };
    for (let i = 0; i < s.length; i += 1) {
        if (Object.prototype.hasOwnProperty.call(lookupTable, s[i])) {
            ret += lookupTable[s[i]];
        } else {
            throw new Error(`Error parsing s[i] at index ${i}`);
        }
    }
    return ret;
}

