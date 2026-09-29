import './app.js';

document.querySelector('.open-route').addEventListener('click', async () => {
  const mod = await import('./route.js');
  document.querySelector('.route').textContent = mod.route;
});
