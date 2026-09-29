import type { Response } from 'playwright';
import { describe, expect, test } from 'vitest';
import { browser, editFile, page, serverUrl, waitForBuildStable } from '~utils';

// A patch can carry a module the tab never ran. Here tab B receives route.js
// in the patch for an edit of shared.js (route.js imports shared.js), but
// never receives dep.js. The later lazy chunk for route.js must still carry
// dep.js: the server walks through route.js (shipped, but never run) instead
// of stopping there.
//
//   main ──static──▶ app ──static──▶ shared
//     └──import()──▶ route ──static──▶ shared
//                         └──static──▶ dep

/** Plant a marker on `window`; any full page reload wipes it. */
const plantMarker = (p: typeof page) =>
  p.evaluate(() => ((window as unknown as { __marker?: string }).__marker = 'alive'));
const readMarker = (p: typeof page) =>
  p.evaluate(() => (window as unknown as { __marker?: string }).__marker ?? null);

const factoryFor = (file: string) => new RegExp(`registerFactory\\("[^"]*/${file}"`);

describe('lazy-walk-through-shipped', () => {
  test('a lazy chunk carries the deps of a module that a patch shipped but the tab never ran', async () => {
    await waitForBuildStable();
    await expect.poll(() => page.textContent('.app')).toBe('shared-v1');

    // Tab B loads the page while route.js is still a lazy stub, so opening the
    // route later in tab B goes through a lazy chunk compiled for tab B.
    const pageB = await browser.newPage();
    const patchBodiesB: Promise<string>[] = [];
    const lazyChunkBodiesB: Promise<string>[] = [];
    pageB.on('response', (res: Response) => {
      if (/\/hmr_patch_\d+\.js(?:\?|$)/.test(res.url())) {
        patchBodiesB.push(res.text());
      } else if (/\/@vite\/lazy\?/.test(res.url())) {
        lazyChunkBodiesB.push(res.text());
      }
    });
    const pageErrorsB: string[] = [];
    pageB.on('pageerror', (err) => pageErrorsB.push(err.message));
    try {
      await pageB.goto(serverUrl);
      await expect.poll(() => pageB.textContent('.app')).toBe('shared-v1');
      await waitForBuildStable();

      // Tab A opens the route: route.js enters the server's module graph.
      await page.click('.open-route');
      await expect.poll(() => page.textContent('.route')).toBe('shared-v1+dep');
      await waitForBuildStable();
      await plantMarker(pageB);

      // The edit hot-updates app.js in tab B. The patch also carries route.js
      // (an importer of shared.js), which tab B has never run.
      editFile('shared.js', (code) => code.replace("'shared-v1'", "'shared-v2'"));
      await expect.poll(() => pageB.textContent('.app')).toBe('shared-v2');
      expect(patchBodiesB.length).toBe(1);
      const patchB = await patchBodiesB[0];
      expect(patchB).toMatch(factoryFor('route.js'));
      expect(patchB).not.toMatch(factoryFor('dep.js'));
      await waitForBuildStable();

      // Tab B opens the route: route.js runs from the patch's factory, and
      // dep.js must come with the lazy chunk.
      await pageB.click('.open-route');
      await expect.poll(() => pageB.textContent('.route')).toBe('shared-v2+dep');
      expect(lazyChunkBodiesB.length).toBe(1);
      expect(await lazyChunkBodiesB[0]).toMatch(factoryFor('dep.js'));
      expect(await readMarker(pageB)).toBe('alive');
      expect(pageErrorsB).toEqual([]);
    } finally {
      await pageB.close();
    }
  });
});
