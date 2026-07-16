'use strict'

// Games Arena runs its backend on Node 24, which supports synchronously
// requiring ESM modules without top-level await. Keeping the implementation in
// genuine ESM lets Vite serve the linked package directly in development while
// this small bridge preserves the backend's CommonJS build contract.
const engineModule = require('./index.mjs')

module.exports = engineModule.default
