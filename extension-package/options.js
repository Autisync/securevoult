document.getElementById('openVault')?.addEventListener('click', (event) => {
  event.preventDefault();
  chrome.tabs.create({ url: 'http://localhost:3000' });
});
