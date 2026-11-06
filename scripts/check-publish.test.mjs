// Focused tests for scripts/check-publish.mjs. Run: npm run test:publish
// Fixtures are built in memory from a tracked clean image, so no file with metadata is committed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { imageProblems, hashPhrase, loadDenylist, retractedHits, secretProblems, unreferencedImages } from './check-publish.mjs';

const clean = readFileSync(new URL('../src/assets/images/people/junlin-yuan-2.jpg', import.meta.url));

// Minimal big-endian EXIF APP1 segment: IFD0 with one ASCII BodySerialNumber (0xA431) entry.
function exifApp1WithSerial(serial) {
  const value = Buffer.from(`${serial}\0`, 'latin1');
  const tiff = Buffer.alloc(8 + 2 + 12 + 4);
  tiff.write('MM\0*', 0, 'latin1');
  tiff.writeUInt32BE(8, 4);                 // IFD0 offset
  tiff.writeUInt16BE(1, 8);                 // one entry
  tiff.writeUInt16BE(0xa431, 10);           // BodySerialNumber
  tiff.writeUInt16BE(2, 12);                // ASCII
  tiff.writeUInt32BE(value.length, 14);
  tiff.writeUInt32BE(tiff.length, 18);      // value stored after the IFD
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff, value]);
  const header = Buffer.from([0xff, 0xe1, 0, 0]);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}

test('clean tracked JPEG passes', () => {
  assert.deepEqual(imageProblems('portrait.jpg', clean), []);
});

test('same JPEG with an EXIF camera serial fails', () => {
  const dirty = Buffer.concat([clean.subarray(0, 2), exifApp1WithSerial('000000000000'), clean.subarray(2)]);
  assert.deepEqual(imageProblems('portrait.jpg', dirty), ['JPEG APP1 segment (Exif)']);
  // Same segment hidden after the compressed scan, just before end-of-image.
  const late = Buffer.concat([clean.subarray(0, -2), exifApp1WithSerial('000000000000'), clean.subarray(-2)]);
  assert.deepEqual(imageProblems('portrait.jpg', late), ['JPEG APP1 segment (Exif)']);
});

test('PNG text chunk fails, clean PNG passes', () => {
  const png = readFileSync(new URL('../public/icon-192.png', import.meta.url));
  assert.deepEqual(imageProblems('icon.png', png), []);
  const data = Buffer.from('Creation Time\0' + '2000:01:01 00:00:00', 'latin1');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write('tEXt', 4, 'latin1');
  data.copy(chunk, 8);                      // CRC left zero: the checker reads chunk types only
  const dirty = Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)]);   // after IHDR
  assert.deepEqual(imageProblems('icon.png', dirty), ['PNG tEXt chunk']);
});

test('retracted wording is matched by hash across punctuation and case', () => {
  const deny = loadDenylist(hashPhrase('the quick brown fox'));
  assert.equal(retractedHits('Notice: The QUICK, brown-fox jumped.', deny).length, 1);
  assert.equal(retractedHits('the quick red fox', deny).length, 0);
});

test('secret files and token patterns fail', () => {
  assert.ok(secretProblems('.env', '').length);
  assert.deepEqual(secretProblems('.env.example', 'KEY='), []);
  assert.ok(secretProblems('x.js', `const t = "ghp_${'a'.repeat(36)}";`).length);
});

test('image no source file names fails; referenced image passes', () => {
  const images = ['src/assets/images/research/used.png', 'src/assets/images/research/unused.png', 'public/icon.png'];
  assert.deepEqual(unreferencedImages(images, 'figure: "../../assets/images/research/used.png"'), ['src/assets/images/research/unused.png']);
});
