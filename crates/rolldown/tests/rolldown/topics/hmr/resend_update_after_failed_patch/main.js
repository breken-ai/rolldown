import assert from 'node:assert';
import './hmr.js';
import { load } from './lazy-holder.js';

// Never call `load`: heavy.js stays an unloaded chunk.
console.log(typeof load);

process.on('beforeExit', (code) => {
  if (code !== 0) return;
  assert.strictEqual(globalThis.__resend_update_after_failed_patch_ran, true);
});
