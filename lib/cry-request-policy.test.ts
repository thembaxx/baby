import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_AUDIO_BASE64_LENGTH, resolveOllamaBaseUrl, validateCryAudio } from './cry-request-policy.ts';

test('server-configured Ollama URL cannot be overridden with SSRF targets', () => {
  assert.equal(resolveOllamaBaseUrl(undefined, undefined), 'http://localhost:11434/v1');
  assert.equal(resolveOllamaBaseUrl('http://localhost:11434/v1/', undefined), 'http://localhost:11434/v1');
  assert.equal(resolveOllamaBaseUrl('https://models.test/v1', 'https://models.test/v1'), 'https://models.test/v1');
  assert.equal(resolveOllamaBaseUrl('http://169.254.169.254/latest/meta-data', undefined), null);
  assert.equal(resolveOllamaBaseUrl('https://evil.test/v1', 'https://models.test/v1'), null);
  assert.equal(resolveOllamaBaseUrl({ url: 'http://localhost:11434/v1' }, undefined), null);
});
test('audio payload validation', () => {
  const sample = Buffer.from('sound'.repeat(20)).toString('base64');
  assert.equal(validateCryAudio(sample, 'audio/webm;codecs=opus'), null);
  assert.equal(validateCryAudio(sample, 'audio/mp4'), null);
  assert.match(validateCryAudio('', 'audio/webm') || '', /missing/);
  assert.match(validateCryAudio('X'.repeat(MAX_AUDIO_BASE64_LENGTH+1), 'audio/webm') || '', /too large/);
  assert.match(validateCryAudio('!'.repeat(100), 'audio/webm') || '', /base64/);
  assert.match(validateCryAudio(sample, 'text/html') || '', /Unsupported/);
});
