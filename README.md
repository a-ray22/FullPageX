# FullPageX - Chrome Extension

A powerful Chrome extension for capturing and editing full-page screenshots with advanced features.

## Features

- Capture full-page screenshots of any webpage
- Capture portion of the web-page as a recording
- Advanced image editing capabilities using Fabric.js
- PDF export functionality
- Custom cropping and annotation tools
- User-friendly interface

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Development

The extension is built using:
- Vanilla JavaScript
- Fabric.js for image editing
- jsPDF for PDF generation

### Project Structure

- `manifest.json` - Extension configuration
- `popup.html/js` - Extension popup interface
- `background.js` - Background service worker
- `screenshot.js` - Screenshot capture logic
- `fabric_cropper.html/js` - Image editing interface
- `recorder.js` - Screen recording functionality
- `libs/` - Third-party libraries
- `icons/` - Extension icons

## License

MIT License

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request 
