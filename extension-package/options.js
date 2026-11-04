document.getElementById('openVault')?.addEventListener('click', (event) => {
  event.preventDefault();
  chrome.tabs.create({ url: 'https://vault.autisync.com' });
});
