chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action === "fillDropdowns") {
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError.message);
        return;
      }

      if (tabs.length === 0) {
        console.error('No active tab found.');
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, request).then((response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message:', chrome.runtime.lastError.message);
          return;
        }
      }).catch((error) => {
        console.error('Error sending message:', error.message);
      });
    }).catch((error) => {
      console.error('Error querying tabs:', error.message);
    });
  }
});
