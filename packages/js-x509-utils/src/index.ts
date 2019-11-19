/**
 * index.ts
 */

import * as x509 from './x509';

export const fromJwk = x509.fromJwk;
export const toJwk = x509.toJwk;
export const parse = x509.parse;

export default {fromJwk, toJwk, parse};
