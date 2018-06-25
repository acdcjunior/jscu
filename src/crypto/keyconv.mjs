/**
 * For key conversion between jwk and pem
 * keyconv.mjs
 */

import helper from '../helper/index.mjs';
import cryptoUtil from './util/index.mjs';

import pino from 'pino';
// log options
const logOptions = cryptoUtil.env.getEnvLogOptions();
const logger = pino(Object.assign(logOptions, {name: 'conv'}));

const dynamicLoadElliptic = async () => cryptoUtil.env.dynamicModuleLoad(await import(/* webpackChunkName: 'elliptic' */ './elliptic/index.mjs'));

/**
 * convert key in jwk format to pem spki/pkcs8
 * @param jwkey
 * @param type
 * @return {Promise<*|*>}
 */
export async function jwkToPem(jwkey, type) {
  if (type !== 'public' && type !== 'private') throw new Error('type must be public or private');

  const algo = cryptoUtil.algo.getWebCryptoParamsFromJwk(jwkey, 'sign'); // just for importing

  const crypto = await cryptoUtil.env.getEnvWebCrypto(); // web crypto api or its implementation on node.js

  let pemKey;
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.subtle === 'object'
      && typeof crypto.subtle.exportKey === 'function' && typeof crypto.subtle.importKey === 'function'
      && false // TODO FF対応のため強制False
    ) { // eslint-disable-line // no-constant-condition
      logger.debug('modern webcrypto api is possibly usable to convert jwk to spki/pkcs8');
      const structure = (type === 'public') ? 'spki' : 'pkcs8';

      let usages = [];
      if(algo.name === 'ECDSA') usages = (type === 'public') ? ['verify'] : ['sign'];
      else if (algo.name === 'ECDH') usages = (type === 'public') ? ['encrypt'] : ['decrypt'];

      delete jwkey.key_ops; // just for importing

      const key = await crypto.subtle.importKey('jwk', jwkey, algo, true, usages);
      const binKey = await crypto.subtle.exportKey(structure, key);
      pemKey = await helper.formatter.binToPem(binKey, type);
    }
    else throw new Error('fall back to elliptic');
  }
  catch (e) { // IE is here
    logger.info('web crypto api is not supported. external lib is used for conversion.');
    if (jwkey.kty === 'EC') pemKey = await jwkToPemElliptic(jwkey, type, algo.namedCurve);
    else throw new Error('RSA is unsupported at this point');
  }

  return pemKey;
}

/**
 * support function to use external elliptic curve lib for legacy browsers.
 * @param jwkey
 * @param type
 * @param namedCurve
 * @return {Promise<void>}
 */
async function jwkToPemElliptic(jwkey, type, namedCurve) {
  const elliptic = await dynamicLoadElliptic();
  const binKey = await elliptic.keyconv.JwkToBin(jwkey, type, namedCurve);
  return await helper.formatter.binToPem(binKey, type);
}

/**
 * convert pem spki/pkcs8 to jwk
 * @param pem
 * @param type
 * @param keyParams
 * @return {Promise<*>}
 */
export async function pemToJwk(pem, type, keyParams) {
  if (type !== 'public' && type !== 'private') throw new Error('type must be public or private');
  let jwkey;
  const crypto = await cryptoUtil.env.getEnvWebCrypto(); // web crypto api or its implementation on node.js

  if(keyParams.keyType !== 'EC') throw new Error('RSA is unsupported at this point');
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.subtle === 'object'
      && typeof crypto.subtle.exportKey === 'function' && typeof crypto.subtle.importKey === 'function'
      && keyParams.namedCurve // if null/undefined, conversion is impossible using WebCrypto without binary analysis... TODO: add RSA condition
    ) {
      const structure = (type === 'public') ? 'spki' : 'pkcs8';

      const usages = (type === 'public') ? ['verify'] : ['sign']; // just for importing

      const binKey = await helper.formatter.pemToBin(pem);
      const key = await crypto.subtle.importKey(structure, binKey, {name: 'ECDSA', namedCurve: keyParams.namedCurve}, true, usages); // just for importing
      jwkey = await crypto.subtle.exportKey('jwk', key);
      delete jwkey.key_ops; // key pair is exported as both for ecdh and ecdsa
    }
    else throw new Error('fall back to Elliptic');
  }
  catch(e) { // IE is here
    logger.info('web crypto api is not supported. external lib is used for conversion.');
    if (keyParams.keyType === 'EC') jwkey = await pemToJwkElliptic(pem, type);
  }
  return jwkey;
}

/**
 * support function to use external elliptic curve lib for legacy browsers.
 * @param pem
 * @param type
 * @return {Promise<*>}
 */
// TODO: ここはellipticに吸収したほうが良さそう。
async function pemToJwkElliptic(pem, type) {
  const elliptic = await dynamicLoadElliptic();
  const binKey = await helper.formatter.pemToBin(pem);
  return await elliptic.keyconv.binToJwk(binKey, type);
}