import { value } from './value.js';

document.querySelector('.lib').textContent = `lib-v1:${value}`;

import.meta.hot?.accept();
