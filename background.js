chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  if (message.action === "capture") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      sendResponse(dataUrl);
    });
    return true;
  }

  if (message.action === 'openCropperTab' && message.url) {
    chrome.tabs.create({ url: message.url }, () => {
      console.log('Opened cropper tab:', message.url);
      sendResponse({ success: true });
    });
    return true;
  }
});
