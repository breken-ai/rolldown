document.querySelector('.open-a').addEventListener('click', () => {
  import('./route-a.js');
});
document.querySelector('.open-b').addEventListener('click', async () => {
  const mod = await import('./route-b.js');
  document.querySelector('.b').textContent = mod.b;
});
