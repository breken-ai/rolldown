import assert from 'node:assert';
import { heavy } from './heavy.js';

export const value = 'v3';
assert.strictEqual(heavy, 'heavy');
globalThis.__resend_update_after_failed_patch_ran = true;
import.meta.hot.accept();
