import {getTestEnv} from './prepare.js';
const env = getTestEnv();
const jscu = env.library;
const envName = env.envName;

import jseu from 'js-encoding-utils';

let crypto;
if (typeof window !== 'undefined' && typeof window.crypto !== 'undefined' && typeof window.crypto.subtle === 'object'
  && typeof window.crypto.subtle.importKey === 'function' && typeof window.crypto.subtle.sign === 'function') {
  crypto = window.crypto;
}
else crypto = null;

import chai from 'chai';
// const should = chai.should();
const expect = chai.expect;

const curves = ['P-256', 'P-384', 'P-521'];
const hashes = [ 'SHA-256', 'SHA-384', 'SHA-512'];
describe(`${envName}: Generated JWK key should be successfully converted to PEM SPKI/PKCS8, and vice varsa`, () => {
  let keySet = [];
  let msg;
  before( async () => {
    if (!crypto){
      crypto = require('node-webcrypto-ossl');
      if(typeof crypto !== 'undefined' && typeof crypto.WebCrypto !== 'function' && typeof crypto.default !=='undefined')
        crypto = crypto.default;
      crypto = new crypto();
    }

    keySet = await Promise.all(curves.map( async (crv) => await jscu.pkc.generateKey('EC', {namedCurve: crv})));
    msg = new Uint8Array(32);
    for(let i = 0; i < 32; i++) msg[i] = 0xFF & i;
  });


  it('Signature generated by JWK should be successfully verified by converted PEM (bin) key via WebCrypto.', async () => {
    await Promise.all(
      curves.map( async (curve, idx) => await Promise.all(
        hashes.map( async (hash) => {
          const sig = await jscu.pkc.sign(msg, keySet[idx].privateKey, hash);

          const pko = new jscu.Key('jwk', keySet[idx].publicKey);
          const pemPub = await pko.export('pem');
          const binKey = jseu.formatter.pemToBin(pemPub);
          const key = await crypto.subtle.importKey('spki', binKey, {name: 'ECDSA', namedCurve: curve}, true, ['verify']);
          const result = await crypto.subtle.verify({name: 'ECDSA', namedCurve: curve, hash: { name: hash }}, key, sig, msg);
          expect(result).to.be.true;
          return result;
        })
      ))
    );
  });

  it('Signature generated by WebCrypto with convereted PEM (bin) key should be successfully verified by JWK', async () => {
    await Promise.all(
      curves.map( async (curve, idx) => await Promise.all(
        hashes.map( async (hash) => {
          const pko = new jscu.Key('jwk', keySet[idx].privateKey);
          const pemPriv = await pko.export('pem');
          const binKey = jseu.formatter.pemToBin(pemPriv);
          const key = await crypto.subtle.importKey('pkcs8', binKey, {name: 'ECDSA', namedCurve: curve}, false, ['sign']);
          const sig = await crypto.subtle.sign({name: 'ECDSA', namedCurve: curve, hash: { name: hash }}, key, msg);
          const result = await jscu.pkc.verify(msg, sig, keySet[idx].publicKey, hash);
          expect(result).to.be.true;
          return result;
        })
      ))
    );
  });
});

describe(`${envName}: PEM SPKI/PKCS8 key should be successfully converted to usable JWK`, () => {
  const pubOSSL =
    '-----BEGIN PUBLIC KEY-----\n' +
    'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEpbsQYkkaJa+rvxkad9m7gOuc8p3D\n' +
    'qd8N37+bvD59VPVPgkbVHFjzeJqZMk5TS4/RbT8SUqKmQ2sb1l+svNP8LQ==\n' +
    '-----END PUBLIC KEY-----';
  const privOSSL =
    '-----BEGIN PRIVATE KEY-----\n' +
    'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg8N6DZSFlKf+X6MaN\n' +
    'qo3hc7J2q4HeWn+E71cKfPhRtqOhRANCAASluxBiSRolr6u/GRp32buA65zyncOp\n' +
    '3w3fv5u8Pn1U9U+CRtUcWPN4mpkyTlNLj9FtPxJSoqZDaxvWX6y80/wt\n' +
    '-----END PRIVATE KEY-----\n';
  let msg;
  before( async () => {
    msg = new Uint8Array(32);
    for(let i = 0; i < 32; i++) msg[i] = 0xFF & i;
  });

  it('JWK converted from PEM should successfully sign and verify messages', async () => {
    await Promise.all(
      hashes.map( async (hash) => {
        const pubko = new jscu.Key('pem', pubOSSL);
        const priko = new jscu.Key('pem', privOSSL);
        const jwkPriv = await priko.export('jwk');
        const jwkPub = await pubko.export('jwk');

        const sig = await jscu.pkc.sign(msg, jwkPriv, hash);
        const result = await jscu.pkc.verify(msg, sig, jwkPub, hash);
        expect(result).to.be.true;
        return result;
      })
    );
  });
});