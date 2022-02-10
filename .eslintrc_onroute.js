module.exports = {
    "env": {
        "browser": true,
        "node": true,
        "es6": true,
    },
    "extends": [
      "eslint:recommended",
    ],
    "globals": {
      "routetype": "readonly",
      "req": "readonly",
      "res": "readonly",
      "callback": "readonly",
      "require": "readonly",
      "jsh": "readonly",
      "modelid": "readonly",
      "params": "readonly",
    },
    "parserOptions": {
        "ecmaVersion": 8
    },
    "rules": {
        "no-trailing-spaces":[
          "error",
          { "skipBlankLines": true }
        ],
        "indent": [
            "error",
            2,
            { "SwitchCase":1 }
        ],
        "linebreak-style": [
            "error",
            "windows"
        ],
        "quotes": [
            "error",
            "single",
            { "avoidEscape": true }
        ],
        "semi": [
            "error",
            "always"
        ],
        "no-unused-vars": [
          "error",
          {
            "args": "none"
          }
        ],
        "no-cond-assign": [
          "error",
          "except-parens"
        ]
    }
};