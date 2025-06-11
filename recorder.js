(() => {
  if (window.__recorderActive) return;
  window.__recorderActive = true;

  // --- UI Setup ---

  const shapeSelector = document.createElement('select');
  ['rectangle', 'circle', 'freeform'].forEach(shape => {
    const option = document.createElement('option');
    option.value = shape;
    option.textContent = shape.charAt(0).toUpperCase() + shape.slice(1);
    shapeSelector.appendChild(option);
  });
  Object.assign(shapeSelector.style, {
    position: 'fixed',
    top: '10px',
    left: '10px',
    zIndex: 1000000,
    fontSize: '14px',
    padding: '4px',
  });
  document.body.appendChild(shapeSelector);

  const btnStart = document.createElement('button');
  btnStart.textContent = 'Start Recording';
  const btnStop = document.createElement('button');
  btnStop.textContent = 'Stop Recording';
  btnStop.disabled = true;
  const btnExit = document.createElement('button');
  btnExit.textContent = 'Exit';
  const timerDisplay = document.createElement('div');
  timerDisplay.textContent = '⏱ 0.0s';

  [btnStart, btnStop, btnExit, timerDisplay].forEach((el, i) => {
    Object.assign(el.style, {
      position: 'fixed',
      top: '10px',
      left: `${160 + i * 120}px`,
      zIndex: 1000000,
      padding: '6px 10px',
      fontSize: '14px',
      backgroundColor: '#111',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      userSelect: 'none',
      transition: 'transform 0.1s ease',
      outline: 'none',
    });
    document.body.appendChild(el);
  });

  // Add simple click animation
  function addClickAnimation(button) {
    button.addEventListener('mousedown', () => {
      button.style.transform = 'scale(0.95)';
    });
    button.addEventListener('mouseup', () => {
      button.style.transform = 'scale(1)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
    });
  }
  [btnStart, btnStop, btnExit].forEach(addClickAnimation);

  // --- Drawing Layer ---

  const drawLayer = document.createElement('div');
  Object.assign(drawLayer.style, {
    position: 'fixed',
    top: 0, left: 0, width: '100vw', height: '100vh',
    zIndex: 999998,
    pointerEvents: 'none',
  });
  document.body.appendChild(drawLayer);

  let shape = 'rectangle';
  shapeSelector.value = shape;
  shapeSelector.addEventListener('change', () => {
    shape = shapeSelector.value;
    resetShape();
  });

  let selector, radiusHandle, freeformCanvas, freeformCtx;
  let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
  let isResizing = false;
  let resizeDir = null;

  let freeformPoints = [];
  let isDrawingFreeform = false;

  // Reset shape drawing
  function resetShape() {
    drawLayer.innerHTML = '';
    freeformPoints = [];
    isDrawingFreeform = false;

    if (selector) {
      selector.remove();
      selector = null;
    }
    if (radiusHandle) {
      radiusHandle.remove();
      radiusHandle = null;
    }
    if (freeformCanvas) {
      freeformCanvas.removeEventListener('mousedown', freeformMouseDown);
      freeformCanvas.removeEventListener('mousemove', freeformMouseMove);
      freeformCanvas.removeEventListener('mouseup', freeformMouseUp);
      freeformCanvas.remove();
      freeformCanvas = null;
      freeformCtx = null;
    }
    if (shape === 'freeform') {
      initFreeform();
    } else {
      createResizableSelector();
    }
  }

  // Create draggable & resizable rectangle or circle selector
  function createResizableSelector() {
    selector = document.createElement('div');
    Object.assign(selector.style, {
      position: 'fixed',
      top: '100px',
      left: '100px',
      width: '300px',
      height: '200px',
      border: '4px solid darkred',  // 4px border for better cropping margin
      backgroundColor: 'transparent',
      boxSizing: 'border-box',
      cursor: 'move',
      userSelect: 'none',
      zIndex: 999999,
      pointerEvents: 'auto',
      borderRadius: shape === 'circle' ? '50%' : '0',
    });

    drawLayer.appendChild(selector);

    // Create resize handles at corners
    const corners = ['nw', 'ne', 'sw', 'se'];
    corners.forEach(corner => {
      const handle = document.createElement('div');
      Object.assign(handle.style, {
        position: 'absolute',
        width: '16px',
        height: '16px',
        backgroundColor: 'darkred',
        borderRadius: '50%',
        zIndex: 1000001,
        cursor: `${corner}-resize`,
        pointerEvents: 'auto',
      });
      switch (corner) {
        case 'nw': handle.style.left = '-8px'; handle.style.top = '-8px'; break;
        case 'ne': handle.style.right = '-8px'; handle.style.top = '-8px'; break;
        case 'sw': handle.style.left = '-8px'; handle.style.bottom = '-8px'; break;
        case 'se': handle.style.right = '-8px'; handle.style.bottom = '-8px'; break;
      }
      selector.appendChild(handle);

      handle.addEventListener('mousedown', e => {
        e.stopPropagation();
        isResizing = true;
        resizeDir = corner;
        dragOffsetX = e.clientX;
        dragOffsetY = e.clientY;
        e.preventDefault();
      });
    });

    // Drag selector to move
    selector.addEventListener('mousedown', e => {
      if (e.target.parentElement === selector) return; // skip if clicked on handle
      if (isResizing) return;
      isDragging = true;
      const rect = selector.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      e.preventDefault();
    });

    window.addEventListener('mousemove', e => {
      if (isDragging) {
        let left = e.clientX - dragOffsetX;
        let top = e.clientY - dragOffsetY;
        left = Math.max(0, Math.min(left, window.innerWidth - selector.offsetWidth));
        top = Math.max(0, Math.min(top, window.innerHeight - selector.offsetHeight));
        selector.style.left = `${left}px`;
        selector.style.top = `${top}px`;
      } else if (isResizing) {
        resizeShape(e);
      }
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
      isResizing = false;
    });

    function resizeShape(e) {
      const rect = selector.getBoundingClientRect();
      let left = rect.left;
      let top = rect.top;
      let width = rect.width;
      let height = rect.height;

      const dx = e.clientX - dragOffsetX;
      const dy = e.clientY - dragOffsetY;

      if (resizeDir.includes('n')) {
        top += dy;
        height -= dy;
      }
      if (resizeDir.includes('w')) {
        left += dx;
        width -= dx;
      }
      if (resizeDir.includes('s')) {
        height += dy;
      }
      if (resizeDir.includes('e')) {
        width += dx;
      }

      const minSize = 30;
      if (width < minSize) width = minSize;
      if (height < minSize) height = minSize;

      selector.style.left = `${left}px`;
      selector.style.top = `${top}px`;
      selector.style.width = `${width}px`;
      selector.style.height = `${height}px`;

      dragOffsetX = e.clientX;
      dragOffsetY = e.clientY;
    }
  }

  // --- Freeform drawing ---

  function initFreeform() {
    freeformCanvas = document.createElement('canvas');
    freeformCanvas.width = window.innerWidth;
    freeformCanvas.height = window.innerHeight;
    Object.assign(freeformCanvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      zIndex: 999999,
      cursor: 'crosshair',
      backgroundColor: 'transparent',
      pointerEvents: 'auto',
    });
    drawLayer.appendChild(freeformCanvas);

    freeformCtx = freeformCanvas.getContext('2d');
    freeformCtx.strokeStyle = 'darkred';
    freeformCtx.lineWidth = 2;
    freeformCtx.lineJoin = 'round';
    freeformCtx.lineCap = 'round';

    freeformCanvas.addEventListener('mousedown', freeformMouseDown);
    freeformCanvas.addEventListener('mousemove', freeformMouseMove);
    freeformCanvas.addEventListener('mouseup', freeformMouseUp);
  }



  function freeformMouseDown(e) {
    isDrawingFreeform = true;
    freeformPoints = [{ x: e.clientX, y: e.clientY }];
    freeformCtx.clearRect(0, 0, freeformCanvas.width, freeformCanvas.height);
    freeformCtx.beginPath();
    freeformCtx.moveTo(e.clientX, e.clientY);
  }

  function freeformMouseMove(e) {
    if (!isDrawingFreeform) return;
    freeformPoints.push({ x: e.clientX, y: e.clientY });
    freeformCtx.lineTo(e.clientX, e.clientY);
    freeformCtx.stroke();
  }

  function freeformMouseUp(e) {
    if (!isDrawingFreeform) return;
    isDrawingFreeform = false;
    freeformCtx.closePath();
    // Allow redraw by keeping pointer events enabled
  }

  // Reset drawing shapes on shape change
  function resetShape() {
    drawLayer.innerHTML = '';
    freeformPoints = [];
    isDrawingFreeform = false;
    if (selector) {
      selector.remove();
      selector = null;
    }
    if (freeformCanvas) {
      freeformCanvas.removeEventListener('mousedown', freeformMouseDown);
      freeformCanvas.removeEventListener('mousemove', freeformMouseMove);
      freeformCanvas.removeEventListener('mouseup', freeformMouseUp);
      freeformCanvas.remove();
      freeformCanvas = null;
      freeformCtx = null;
    }
    if (shape === 'freeform') {
      initFreeform();
    } else {
      createResizableSelector();
    }
  }

  resetShape();

  // --- Recording ---

  let recording = false;
  let intervalId = null;
  let elapsedSeconds = 0;
  let chunks = [];
  let mediaRecorder = null;
  const offscreenCanvas = document.createElement('canvas');
  const ctx = offscreenCanvas.getContext('2d');

  btnStart.onclick = () => {
    if (recording) return;

    let clipRect, useFreeformPoints;

    if (shape === 'freeform') {
      if (freeformPoints.length < 3) {
        alert('Please draw a freeform shape before recording.');
        return;
      }
      const first = freeformPoints[0];
      const last = freeformPoints[freeformPoints.length - 1];
      const dist = Math.hypot(last.x - first.x, last.y - first.y);
      if (dist > 15) {
        alert('Please close the freeform shape before recording.');
        freeformPoints = [];
        freeformCtx.clearRect(0, 0, freeformCanvas.width, freeformCanvas.height);
        return;
      }
      useFreeformPoints = true;
      const xs = freeformPoints.map(p => p.x);
      const ys = freeformPoints.map(p => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      clipRect = { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
    } else {
      useFreeformPoints = false;
      if (!selector) {
        alert('No region selected!');
        return;
      }
      const rect = selector.getBoundingClientRect();
      const borderWidth = 4; // match CSS border width
      // Crop inside the border
      clipRect = { 
        left: rect.left + borderWidth, 
        top: rect.top + borderWidth, 
        width: rect.width - 2 * borderWidth, 
        height: rect.height - 2 * borderWidth 
      };
    }

    offscreenCanvas.width = clipRect.width;
    offscreenCanvas.height = clipRect.height;

    chunks = [];
    elapsedSeconds = 0;
    timerDisplay.textContent = '⏱ 0.0s';
    recording = true;
    btnStart.disabled = true;
    btnStop.disabled = false;

    const stream = offscreenCanvas.captureStream(30);
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });

    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'recording.webm';
      a.click();
      URL.revokeObjectURL(url);
    };

    mediaRecorder.start();

    intervalId = setInterval(() => {
      elapsedSeconds += 0.3;
      timerDisplay.textContent = `⏱ ${elapsedSeconds.toFixed(1)}s`;

      chrome.runtime.sendMessage({ action: 'capture' }, dataUrl => {
        if (!dataUrl) return;

        const img = new Image();
        img.onload = () => {
          const scrollX = window.scrollX || window.pageXOffset;
          const scrollY = window.scrollY || window.pageYOffset;
          const scale = window.devicePixelRatio || 1;

          ctx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
          ctx.save();

          if (shape === 'circle') {
            const centerX = clipRect.width / 2;
            const centerY = clipRect.height / 2;
            const radius = Math.min(centerX, centerY);

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.clip();

          } else if (shape === 'freeform' && useFreeformPoints) {
            ctx.beginPath();
            ctx.moveTo(freeformPoints[0].x - clipRect.left, freeformPoints[0].y - clipRect.top);
            freeformPoints.forEach(p => {
              ctx.lineTo(p.x - clipRect.left, p.y - clipRect.top);
            });
            ctx.closePath();
            ctx.clip();
          }
          // rectangle no clipping needed

          ctx.drawImage(
            img,
            (clipRect.left + scrollX) * scale,
            (clipRect.top + scrollY) * scale,
            clipRect.width * scale,
            clipRect.height * scale,
            0,
            0,
            clipRect.width,
            clipRect.height
          );

          ctx.restore();
        };
        img.src = dataUrl;
      });
    }, 300);
  };

  btnStop.onclick = () => {
    if (!recording) return;
    recording = false;
    btnStart.disabled = false;
    btnStop.disabled = true;
    timerDisplay.textContent = '⏱ Processing...';

    clearInterval(intervalId);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  };

  btnExit.onclick = () => {
    // Cleanup UI and recording state
    if (recording) {
      clearInterval(intervalId);
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      recording = false;
    }
    // Remove all overlays and UI
    shapeSelector.remove();
    btnStart.remove();
    btnStop.remove();
    btnExit.remove();
    timerDisplay.remove();
    drawLayer.remove();
    window.__recorderActive = false;
  };
})();
