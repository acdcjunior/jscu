/**
 * util.js
 */

import jseu from 'js-encoding-utils';
import params from './params.js';
import {KeyStructure} from './asn1def.js';

/**
 * Check if the given key is encrypted.
 * @param {DER|PEM} key - Private key object in ASN.1 encoding.
 * @param {AsnFormat} [format='pem'] - pem or der
 * @return {boolean} - True if encrypted.
 */
export const isAsn1Encrypted = (key, format='pem') => {
  let keyType;
  try{ keyType = getAsn1KeyType(key, format);} catch(e) {return false;}
  return keyType === 'encryptedPrivate';
};

/**
 * Check if the given key is public.
 * @param {DER|PEM} key - Public key object in ASN.1 encoding.
 * @param {AsnFormat} format - pem or der
 * @return {boolean} - True if public.
 */
export const isAsn1Public = (key, format='pem') => {
  let keyType;
  try{ keyType = getAsn1KeyType(key, format);} catch(e) {return false;}
  return (keyType === 'public');
};

/**
 * Retrieve the key type of public or private in ASN.1 format
 * @param {DER|PEM} key - Key object in ASN.1 encoding.
 * @param {AsnFormat} format - pem or der
 * @return {'public'|'private'|'encryptedPrivate'} - The key type of the given key.
 * @throws {Error} - Throws if NotSpkiNorPkcs8Key.
 */
export const getAsn1KeyType = (key, format='pem') => {
  // Peel the pem strings
  const binKey = (format === 'pem') ? jseu.formatter.pemToBin(key, 'private') : key;

  const decoded = KeyStructure.decode(Buffer.from(binKey), 'der');
  if (decoded.type === 'encryptedPrivateKeyInfo') return 'encryptedPrivate';
  else if (decoded.type === 'oneAsymmetricKey') return 'private';
  else if (decoded.type === 'subjectPublicKeyInfo') return 'public';
  else throw new Error('NotSpkiNorPkcs8Key');
};

/**
 * Retrieve the type of SEC1 octet key.
 * @param {OctetEC} sec1key - Key object in OctetEC encoding in String (hex string) or Uint8Array.
 * @param {String} namedCurve - Name of elliptic curve like 'P-256'.
 * @return {PublicOrPrivate} - public or private
 * @throws {Error} - Throws if UnsupportedKeyStructure.
 */
export const getSec1KeyType = (sec1key, namedCurve)=> {
  let format;
  if (sec1key instanceof Uint8Array) format = 'binary';
  else if (typeof sec1key === 'string') format = 'string';
  else throw new Error('InvalidObjectType');

  const binKey = (format === 'string') ? jseu.encoder.hexStringToArrayBuffer(sec1key): sec1key;

  const len = params.namedCurves[namedCurve].payloadSize;

  // original key type
  if (binKey.length <= len) return 'private';
  else if (
    (binKey.length === 2*len+1 && binKey[0] === 0x04)
    || (binKey.length === len+1 && (binKey[0] === 0x02 || binKey[0] === 0x03))
  ) return 'public';
  else throw new Error('UnsupportedKeyStructure');
};

/**
 * Check key type of JWK.
 * @param {JsonWebKey} jwkey - Key object in JWK format.
 * @return {PublicOrPrivate} - public or private
 * @throws {Error} - Throws if InvalidECKey, InvalidRSAKey or UnsupportedJWKType.
 */
export const getJwkType = (jwkey) => {
  if(jwkey.kty === 'EC'){
    if (jwkey.x && jwkey.y && jwkey.d) return 'private';
    else if (jwkey.x && jwkey.y) return 'public';
    else throw new Error('InvalidECKey');
  }
  else if (jwkey.kty === 'RSA'){
    if (jwkey.n && jwkey.e && jwkey.d && jwkey.p && jwkey.q && jwkey.dp && jwkey.dq && jwkey.qi) return 'private';
    else if (jwkey.n && jwkey.e) return 'public';
    else throw new Error('InvalidRSAKey');
  }
  else throw new Error('UnsupportedJWKType');
};

/**
 * Prune leading zeros of an octet sequence in Uint8Array for jwk formatting of RSA.
 * https://tools.ietf.org/html/rfc7518#section-6.3
 * @param {Uint8Array} array - The octet sequence.
 * @return {Uint8Array} - An octet sequence pruned leading zeros of length equal to or shorter than the input array.
 * @throws {Error} - Throws if NonUint8Array.
 */
export const pruneLeadingZeros = (array) => {
  if(!(array instanceof Uint8Array)) throw new Error('NonUint8Array');

  let offset = 0;
  for (let i = 0; i < array.length; i++){
    if(array[i] !== 0x00) break;
    offset++;
  }

  const returnArray = new Uint8Array(array.length - offset);
  returnArray.set(array.slice(offset, array.length));
  return returnArray;
};

// for pem/oct/der formatting from jwk of RSA
/**
 * Append leading zeros and generate an octet sequence of fixed length.
 * @param {Uint8Array} array - An octet sequence.
 * @param {Number} len - Intended length of output sequence.
 * @returns {Uint8Array} - An octet sequence with leading zeros.
 * @throws {Error} - Throws if NonUint8Array or InvalidLength.
 */
export const appendLeadingZeros = (array, len) => {
  if(!(array instanceof Uint8Array)) throw new Error('NonUint8Array');
  if(array.length > len) throw new Error('InvalidLength');

  const returnArray = new Uint8Array(len); // initialized with zeros
  returnArray.set(array, len - array.length);
  return returnArray;
};
