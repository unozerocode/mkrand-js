module.exports = {
    "env": {
        "browser": true,
        "es6": true,
        "node": true,
        "jest" : true
    },
    "extends": "eslint:recommended",
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly"
    },
    "parserOptions": {
        "ecmaVersion": 2018,
        "sourceType": "module"
    },
    "rules": {
        "no-buffer-constructor" : ["error"],
        "require-await" : ["error"],
        "no-shadow" : ["warn"],
        
    },
    "plugins": ["jest"],
    "overrides": [
        {
          "files": ["src/*.js", "__tests__/*.js"]
        }]
};