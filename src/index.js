exports.rand = rand; 
exports.psi_to_binary = psi_to_binary_string;

let cyclic = 0;

function seedUnit() {
    row = Array(128).fill(0, 0, 128);
    row[(128/2)-1] = 1;
    return row;
}

function time_seed_b2() {
    let row = Array(128).fill(0, 0, 128);  
    let d = new Date();
    let n = d.getTime(); 
    let base2 = (n).toString(2);
    let cyclic = 0;

    let start_index = ~~(128 / 2) - ~~(base2.length / 2);
    
    for (let i=0; i<base2.length; i++){
      row[start_index + i] = parseInt(base2[i]);
    }

    
    cyclic = cyclic + 1;
    let cyclic_base2 = (cyclic).toString(2);
    let cyclic_start_index = 128 - cyclic_base2.length;
    
    for(let i= 0; i < cyclic_base2.length; i++){
        row[cyclic_start_index + i] = parseInt(cyclic_base2[i]);
    }
 
    return row;
}

function time_seed_psi() {
   let hex = binary_to_hex(time_seed_b2().join(""));
   if (!hex.valid) {
       console.log("Error converting time_seed_b2 to hex");
       return "[<::>]";
   } else {
     return "[<:" + hex.result + ":>]";
   }
}

function psi_to_binary_string(psi) {

    if (psi.length == 38 && psi.slice(0,3) == "[<:" && psi.slice(35,38) == ":>]") {
        let hex = psi.slice(3,35);
        console.log(`After stripping: ${hex}`)
        let binary = hexToBinary(hex);
        if (binary.valid) {
          return { valid: true, result: binary.result}
        } else {
          return { valid: false, error: "Error converting "}
        }
    } else {
        console.log("psi_to_binary_string invalid format");
        return { valid: false, error: `Invalid format, psi.length: ${psi.length}`}
    }
}

function psi_to_binary_array(psi) {
    let binary_string = psi_to_binary_string(psi);
    if (binary_string.valid) {
      let res_array = Array();
      for (let i=0; i < binary_string.result.length; i++) {
          res_array.push(parseInt(binary_string.result.slice(i,i+1)))
      }
      return {valid: true, result: res_array}
    } else {
      return { valud: false}
    }
}

function rand(seed = time_seed_psi()) {
    let seed_binary_array = psi_to_binary_array(seed);
    let result;
    if (seed_binary_array.valid) {
        result = binary_to_hex(sha30(seed_binary_array.result).join(""));
        if (!result.valid) {
            console.log("Error converting to hex");
            return {valid: false}
        } else {
            return {valid: true, data: result.result};
        }
    } else {
        console.log(`Error parsing seed ${seed}`);
        return {valid: false}
    }
}
// Returns {row: last evaluated row, center: center column}
function eval_block(seed) {
    let ret = seed;
    let center = Array();
    for(let i = 0; i <= 127; i++) {
        ret = eval_rule(ret);
        center.push(ret[(128/2)-1]);
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


/* XOR */
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

function row_xor(a, b) {
    ret = Array();
    for (i=0; i<=127; i++){
        ret[i] = cxor(a[i], b[i]);
    }
    return ret;
}


/* Rule 30 : x(n+1,i) = x(n,i-1) xor [x(n,i) or x(n,i+1)] */
function rule_30( left,  middle,  right){
    return (cxor (left, cor (middle, right)));
  }
  

/* Evaluate source vector with elemental rule, placing result in dest  */
function eval_rule(source){
    let dest = Array(128).fill(0);
    for (let col = 0; col <= 127; col++){
    
       let left_cell   = (col == 0) ? source[127]   : source[col-1];
       let right_cell  = (col == 127) ? source[0]   : source[col+1]; 
       let middle_cell = source[col];
     //  console.log(`Left ${left_cell} Middle ${middle_cell} Right ${right_cell}`) ; 
       dest[col] = rule_30(left_cell, middle_cell, right_cell);  
    //   console.log(`Evaluated ${col} to ${dest[col]}`); 
    }  
    return dest;
 }

 /* SHA30 - Use the input segment as the seed, generate two square fields,
 * keep the center column of the second.
 */

function sha30 (seed) {
    let block = eval_block(seed)
    block = eval_block(block.row)
    return block.center;
}

function binary_to_hex(s) {

    var i, k, part, accum, ret = '';
    for (i = s.length-1; i >= 3; i -= 4) {
        // extract out in substrings of 4 and convert to hex
        part = s.substr(i+1-4, 4);
        accum = 0;
        for (k = 0; k < 4; k += 1) {
            if (part[k] !== '0' && part[k] !== '1') {
                // invalid character
                console.log(`Found invalid character ${part[k]} at index ${k}` )
                return { valid: false };
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
        for (k = 0; k <= i; k += 1) {
            if (s[k] !== '0' && s[k] !== '1') {
                return { valid: false };
            }
            accum = accum * 2 + parseInt(s[k], 10);
        }
        // 3 bits, value cannot exceed 2^3 - 1 = 7, just convert
        ret = String(accum) + ret;
    }
    return { valid: true, result: ret };
}

function hexToBinary(s) {
    var i, k, part, ret = '';
    // lookup table for easier conversion. '0' characters are padded for '1' to '7'
    var lookupTable = {
        '0': '0000', '1': '0001', '2': '0010', '3': '0011', '4': '0100',
        '5': '0101', '6': '0110', '7': '0111', '8': '1000', '9': '1001',
        'a': '1010', 'b': '1011', 'c': '1100', 'd': '1101',
        'e': '1110', 'f': '1111',
        'A': '1010', 'B': '1011', 'C': '1100', 'D': '1101',
        'E': '1110', 'F': '1111'
    };
    for (i = 0; i < s.length; i += 1) {
        if (lookupTable.hasOwnProperty(s[i])) {
            ret += lookupTable[s[i]];
        } else {
            return { valid: false };
        }
    }
    return { valid: true, result: ret };
}

