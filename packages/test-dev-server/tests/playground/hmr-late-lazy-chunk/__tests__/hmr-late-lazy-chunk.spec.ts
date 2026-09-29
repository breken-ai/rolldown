import { describe, expect, test } from 'vitest';
import { editFile, page, waitForBuildStable } from '~utils';

describe('hmr-late-lazy-chunk', () => {
  test('a lazy chunk rendered before an edit does not bring back the old code', async () => {
    await waitForBuildStable();

    let releaseB!: () => void;
    const bReleased = new Promise<void>((resolve) => (releaseB = resolve));
    let bRendered!: () => void;
    const bRenderedPromise = new Promise<void>((resolve) => (bRendered = resolve));
    await page.route(
      (url) => url.pathname === '/@vite/lazy' && url.search.includes('route-b.js'),
      async (route) => {
        const response = await route.fetch();
        bRendered();
        await bReleased;
        await route.fulfill({ response });
      },
    );

    try {
      await page.click('.open-b');
      await bRenderedPromise;

      await page.click('.open-a');
      await expect.poll(() => page.textContent('.lib')).toBe('lib-v1:value-v1');
      await waitForBuildStable();

      editFile('lib.js', (code) => code.replace('lib-v1', 'lib-v2'));
      await expect.poll(() => page.textContent('.lib')).toBe('lib-v2:value-v1');
      await waitForBuildStable();

      releaseB();
      await expect.poll(() => page.textContent('.b')).toBe('b-loaded');
      await waitForBuildStable();

      editFile('value.js', (code) => code.replace('value-v1', 'value-v2'));
      await expect.poll(() => page.textContent('.lib')).toBe('lib-v2:value-v2');
    } finally {
      releaseB();
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  });
});
