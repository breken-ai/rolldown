// FAIL_PATCH
import { heavy } from './heavy.js';

export const value = 'v2';
console.log(heavy);
import.meta.hot.accept();
