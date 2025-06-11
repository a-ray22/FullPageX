(async function () {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  console.log('[Screenshot.js] Starting full page capture...');

  const findAndHideFixedElements = () => {
    return Array.from(document.querySelectorAll('*')).filter(el => {
      try {
        const style = getComputedStyle(el);
        const isFixed = style.position === 'fixed' || style.position === 'sticky';
        const visible = el.offsetHeight > 0 && el.offsetWidth > 0;
        if (isFixed && visible) {
          el.dataset._originalDisplay = el.style.display;
          el.style.setProperty('display', 'none', 'important');
          return true;
        }
      } catch { return false; }
      return false;
    });
  };

  const restoreFixedElements = (elements) => {
    elements.forEach(el => {
      el.style.setProperty('display', el.dataset._originalDisplay || '', 'important');
      delete el.dataset._originalDisplay;
    });
  };

  const totalHeight = document.documentElement.scrollHeight;
  const viewportHeight = window.innerHeight;
  const totalSteps = Math.ceil(totalHeight / viewportHeight);

  console.log(`[Screenshot.js] totalHeight: ${totalHeight}, viewportHeight: ${viewportHeight}, totalSteps: ${totalSteps}`);

  const screenshots = [];

  window.scrollTo(0, 0);
  await sleep(300);

  for (let i = 0; i < totalSteps; i++) {
    const scrollY = i === totalSteps - 1 ? totalHeight - viewportHeight : i * viewportHeight;
    console.log(`[Screenshot.js] Scrolling to Y: ${scrollY} (step ${i + 1}/${totalSteps})`);

    window.scrollTo(0, scrollY);
    await sleep(300);

    const fixedEls = findAndHideFixedElements();
    await sleep(100);

    const dataUrl = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'capture' }, res => {
        if (chrome.runtime.lastError) {
          console.error('[Screenshot.js] Capture error:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(res);
        }
      });
    });

    if (dataUrl) {
      screenshots.push({ dataUrl });
      console.log(`[Screenshot.js] Captured (${i + 1}/${totalSteps})`);
    } else {
      console.warn(`[Screenshot.js] Skipped capture at step ${i + 1}`);
    }

    restoreFixedElements(fixedEls);
    chrome.runtime.sendMessage({ action: 'captureProgress', progress: Math.floor(((i + 1) / totalSteps) * 100) });
  }

  // ✅ Remove duplicate final capture if needed
  if (screenshots.length >= 2) {
    const last = screenshots.at(-1);
    const secondLast = screenshots.at(-2);
    if (last.dataUrl === secondLast.dataUrl) {
      console.log('[Screenshot.js] Removing duplicate final capture.');
      screenshots.pop();
    }
  }

  console.log('[Screenshot.js] All captures complete. Starting stitching...');

  const stitchedDataUrl = await new Promise(resolve => {
    const canvas = document.createElement('canvas');
    let totalHeight = 0;
    const images = [];
    let loaded = 0;

    screenshots.forEach((shot, index) => {
      const img = new Image();
      img.onload = () => {
        images[index] = img;
        totalHeight += img.naturalHeight;
        if (++loaded === screenshots.length) {
          canvas.width = images[0].naturalWidth;
          canvas.height = totalHeight;
          const ctx = canvas.getContext('2d');
          let y = 0;
          images.forEach(img => {
            ctx.drawImage(img, 0, y);
            y += img.naturalHeight;
          });
          resolve(canvas.toDataURL('image/png'));
        }
      };
      img.onerror = () => {
        if (++loaded === screenshots.length) resolve('');
      };
      img.src = shot.dataUrl;
    });
  });

  if (!stitchedDataUrl) {
    alert('[Screenshot.js] Failed to stitch image.');
    return;
  }

  chrome.storage.local.set({ stitchedImage: stitchedDataUrl }, () => {
    const cropperUrl = chrome.runtime.getURL('fabric_cropper.html');
    chrome.runtime.sendMessage({ action: 'openCropperTab', url: cropperUrl }, response => {
      if (response?.success) {
        console.log('[Screenshot.js] Cropper tab opened.');
      } else {
        console.error('[Screenshot.js] Failed to open cropper.');
      }
    });
  });

  chrome.runtime.sendMessage({ action: 'captureProgress', progress: 100 });
})();
