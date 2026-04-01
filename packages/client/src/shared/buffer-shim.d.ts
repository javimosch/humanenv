// Suppress @types/node Buffer/Uint8Array incompatibility with TS 5.9+
declare module 'node:buffer' {
  interface Buffer extends Uint8Array {}
}
