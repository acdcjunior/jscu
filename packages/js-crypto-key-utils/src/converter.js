/**
 * converter.js
 */

import * as asn1enc from './asn1enc.js';
import * as octenc from './octenc.js';

// ASN.1 in RFC5280 (SPKI) and RFC5208 (PKCS8) -> RSA and EC, encode='asn', format='pem' or 'der'
// -> SPKI (in X.509): RFC5280 for public key, PKCS8: RFC5208 for private key
// Octet Form in ANSI X9.63 -> EC, encode='oct', format='string' or 'binary', compact=true or false
// -> Standards for Efficient Cryptography Group (SECG), "SEC1: Elliptic Curve Cryptography", Version 1.0, September 2000.
/**
 * Convert JWK to ASN.1 (for RSA and EC) and Octet (for EC) encoded keys.
 * @param {String} output - 'pem', 'der', or 'oct' (only EC JWK), output format.
 * @param {JsonWebKey} jwkey - A JWK to be encoded.
 * @param {KeyExportOptions} options - Options to export key including encryption options.
 *   For EC JWK : options.compact = true or false
 *   For EC JWK with output = 'oct' : options.format = 'binary' or 'string'
 *   For both: outputPublic (optional) : boolean. derived key type. from private key, public key can be derived when true.
 * @return {PEM|DER|OctetEC} - Output key object.
 */
export async function fromJwkTo(output = 'pem', jwkey, options={}){
  // assertion
  if (['pem', 'der', 'oct'].indexOf(output) < 0) throw new Error('InvalidOutputForm');
  if (typeof jwkey !== 'object') throw new Error('InvalidJWKAsObject');
  if (jwkey.kty !== 'EC' && jwkey.kty !== 'RSA') throw new Error('UnsupportedKeyType');
  if (typeof options.outputPublic !== 'undefined' && typeof options.outputPublic !== 'boolean') throw new Error('outputPublicMustBeBoolean');

  // default values
  if (jwkey.key === 'EC' && typeof options.compact !== 'boolean') options.compact = false;
  if (output === 'oct' && options.output !== 'string') options.output = 'binary';
  if (typeof options.encryptParams === 'undefined') options.encryptParams = {};
  if ((output === 'der' || output === 'pem') && typeof options.encryptParams.passphrase === 'undefined') options.encryptParams.passphrase = '';

  // In the case of PEM/DER
  if (output === 'der' || output === 'pem') {
    return await asn1enc.fromJwk(
      jwkey, output,
      {outputPublic: options.outputPublic, compact: options.compact, encOptions: options.encryptParams }
    );
  }
  // In the case of Oct
  else if (output === 'oct' && jwkey.kty === 'EC') {
    return octenc.fromJwk(jwkey, {outputPublic: options.outputPublic, outputFormat: options.output, compact: options.compact});
  }
  else throw new Error('UnsupportedConversion');

}


/**
 * Convert ASN.1 encoded (for RSA and EC) or octet formed (for EC) keys to JWK.
 * @param {String} input - 'pem', 'der' or 'oct', input key format.
 * @param {PEM|DER|OctetEC} key - A key object to be encoded.
 * @param {JwkExportOptionsInternal} [options={}] - options to export JWK keys.
 * @return {JsonWebKey} - Obtained key object in JWK format.
 * @throws {Error} - Throws if InvalidInputForm, InappropriateOptions, outputPublicMustBeBoolean or UnsupportedConversion
 */
export async function toJwkFrom(input, key, options={}){
  // assertion
  if (['pem', 'der', 'oct'].indexOf(input) < 0) throw new Error('InvalidInputForm');
  if (input === 'oct' && !options.namedCurve ) throw new Error('InappropriateOptions');
  if (typeof options.outputPublic !== 'undefined' && typeof options.outputPublic !== 'boolean') throw new Error('outputPublicMustBeBoolean');

  // default values
  if ((input === 'der' || input === 'pem') && typeof options.passphrase === 'undefined') options.passphrase = '';

  // In the case of PEM
  if (input === 'der' || input === 'pem') {
    return await asn1enc.toJwk(key, input, {outputPublic: options.outputPublic, passphrase: options.passphrase});
  }
  // In the case of Oct
  else if (input === 'oct') {
    return octenc.toJwk(key, options.namedCurve, {outputPublic: options.outputPublic});
  }
  else throw new Error('UnsupportedConversion');
}
