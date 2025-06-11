(() => {
  const { jsPDF } = window.jspdf;

  const canvasElement = document.getElementById('fabric-canvas');
  const canvas = new fabric.Canvas(canvasElement, {
    selection: false,
  });

  let fullImage = null;
  let fabricImage = null;
  let cropRect = null;

  // Load stitched image from storage
  chrome.storage.local.get('stitchedImage', (result) => {
    if (!result.stitchedImage) {
      alert('No image data found!');
      return;
    }
    fullImage = result.stitchedImage;

    fabric.Image.fromURL(fullImage, img => {
      fabricImage = img;

      // Fixed width, scale height proportionally
      const maxWidth = 700;
      const scale = Math.min(maxWidth / img.width, 1);

      canvas.setWidth(maxWidth);
      canvas.setHeight(img.height * scale);

      img.scale(scale);
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));

      // Crop rectangle covering entire image initially
      cropRect = new fabric.Rect({
        left: 0,
        top: 0,
        width: canvas.getWidth(),
        height: canvas.getHeight(),
        fill: 'rgba(0,0,0,0.3)',
        hasBorders: true,
        hasControls: true,
        lockRotation: true,
        cornerColor: '#4caf50',
        cornerSize: 12,
        transparentCorners: false,
        stroke: '#4caf50',
        strokeWidth: 2,
        selectable: true,
        objectCaching: false,
      });

      canvas.add(cropRect);
      canvas.setActiveObject(cropRect);
      canvas.renderAll();
    });
  });

  // Helper: crop image inside cropRect and return a Blob
  function cropImageBlob() {
    if (!fabricImage || !cropRect) {
      alert('Image or crop rectangle missing');
      return null;
    }
    const zoom = fabricImage.scaleX;
    const left = cropRect.left / zoom;
    const top = cropRect.top / zoom;
    const width = cropRect.width / zoom;
    const height = cropRect.height / zoom;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d');

    const imageEl = fabricImage._element;

    ctx.drawImage(
      imageEl,
      left,
      top,
      width,
      height,
      0,
      0,
      width,
      height
    );

    return new Promise(resolve => {
      tempCanvas.toBlob(blob => resolve(blob), 'image/png');
    });
  }

  // Adds slices of imageCanvas as pages to PDF, scaling each slice to fill page
  function addPagesToPDF(pdf, imageCanvas, pdfPageWidthPt, pdfPageHeightPt) {
    const imgWidthPx = imageCanvas.width;
    const imgHeightPx = imageCanvas.height;

    const scale = pdfPageWidthPt / imgWidthPx;
    const pageHeightPx = pdfPageHeightPt / scale;
    const totalPages = Math.ceil(imgHeightPx / pageHeightPx);

    for (let i = 0; i < totalPages; i++) {
      const sliceY = i * pageHeightPx;
      const sliceHeightPx = Math.min(pageHeightPx, imgHeightPx - sliceY);

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = imgWidthPx;
      pageCanvas.height = sliceHeightPx;
      const ctx = pageCanvas.getContext('2d');

      ctx.drawImage(imageCanvas, 0, sliceY, imgWidthPx, sliceHeightPx, 0, 0, imgWidthPx, sliceHeightPx);

      const imgData = pageCanvas.toDataURL('image/png');

      if (i > 0) pdf.addPage();

      const displayHeightPt = (sliceHeightPx * pdfPageWidthPt) / imgWidthPx;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfPageWidthPt, displayHeightPt);
    }
  }

  // Download cropped PNG
  document.getElementById('cropDownload').addEventListener('click', async () => {
    const blob = await cropImageBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cropped_screenshot.png';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Multi-page PDF export for cropped image
  document.getElementById('downloadPDF').addEventListener('click', async () => {
    if (!fabricImage || !cropRect) {
      alert('Image or crop rectangle missing');
      return;
    }

    const zoom = fabricImage.scaleX;
    const left = cropRect.left / zoom;
    const top = cropRect.top / zoom;
    const width = cropRect.width / zoom;
    const height = cropRect.height / zoom;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d');
    const imageEl = fabricImage._element;

    ctx.drawImage(imageEl, left, top, width, height, 0, 0, width, height);

    const pdfPageWidth = 595.28;  // A4 width in points
    const pdfPageHeight = 841.89; // A4 height in points

    const pdf = new jsPDF('p', 'pt', 'a4');

    addPagesToPDF(pdf, tempCanvas, pdfPageWidth, pdfPageHeight);

    pdf.save('cropped_screenshot_multipage.pdf');
  });

  // Download full stitched PNG
  document.getElementById('downloadFullPNG').addEventListener('click', () => {
    if (!fullImage) {
      alert('No image data!');
      return;
    }
    const a = document.createElement('a');
    a.href = fullImage;
    a.download = 'full_screenshot.png';
    a.click();
  });

  // Multi-page PDF export for full stitched image
  document.getElementById('downloadFullPDF').addEventListener('click', () => {
    if (!fullImage) {
      alert('No image data!');
      return;
    }

    const img = new Image();
    img.src = fullImage;
    img.onload = () => {
      const imgWidthPx = img.naturalWidth;
      const imgHeightPx = img.naturalHeight;

      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = imgWidthPx;
      fullCanvas.height = imgHeightPx;
      const ctx = fullCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const pdfPageWidth = 595.28;
      const pdfPageHeight = 841.89;

      const pdf = new jsPDF('p', 'pt', 'a4');

      addPagesToPDF(pdf, fullCanvas, pdfPageWidth, pdfPageHeight);

      pdf.save('full_screenshot_multipage.pdf');
    };
  });
})();
