module.exports = {
    "env": {
        "browser": true,
    },
    "extends": [
        "eslint:recommended",
    ],
    "parserOptions": {
        "ecmaVersion": 6
    },
    "globals": {
      "jsh": "readonly",
      "modelid": "readonly",
      "XExt": "readonly",
      "XForm": "readonly",
      "XPage": "readonly",
      "XValidate": "readonly",
      "XBase": "readonly",
      "XModels": "readonly",
      "XFormat": "readonly",
      "$": "readonly",
      "_": "readonly",
      "ejs": "readonly",
      "moment": "readonly",
      "async": "readonly",
      "xmodel": "readonly",
      "_GET": "readonly",
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