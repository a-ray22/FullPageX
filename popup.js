let currentTabId = null;

// Get currently active tab
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  currentTabId = tab.id;
});

const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');

// Full page screenshot button
document.getElementById('captureBtn').addEventListener('click', () => {
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';

  // Inject screenshot.js and handle progress via messages
  chrome.scripting.executeScript({
    target: { tabId: currentTabId },
    files: ['screenshot.js']
  });

  // Listen for progress messages from screenshot.js
  chrome.runtime.onMessage.addListener(function listener(message, sender) {
    if (message.action === 'captureProgress') {
      progressBar.style.width = message.progress + '%';
      if (message.progress >= 100) {
        progressContainer.style.display = 'none';
        chrome.runtime.onMessage.removeListener(listener);
      }
    }
  });
});

// Screen2GIF button: inject recorder.js script
document.getElementById('startGif').addEventListener('click', () => {
  chrome.scripting.executeScript({
    target: { tabId: currentTabId },
    files: ['recorder.js']
  });
});
