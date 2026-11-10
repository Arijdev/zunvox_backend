const fs = require('fs');
const path = require('path');
const http = require('http');
const sharp = require('sharp');
const FormData = require('form-data');
const axios = require('axios');
const app = require('../src/app');

async function testHttpEndpoints() {
  console.log('--- Starting HTTP Integration Tests ---');

  // Start app on random available port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Server listening on port ${port}`);

  try {
    // 1. Test /health endpoint
    console.log('Testing GET /health...');
    const healthRes = await axios.get(`${baseUrl}/health`, { validateStatus: () => true });
    console.log('Health response status:', healthRes.status);
    console.log('Health service state:', healthRes.data.services);

    // 2. Test POST /api/images/overlay-text with an uploaded image
    console.log('Testing POST /api/images/overlay-text...');
    const tempInputImage = path.join(__dirname, 'http_test_input.jpg');
    await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 3,
        background: { r: 200, g: 80, b: 50 },
      },
    })
      .jpeg()
      .toFile(tempInputImage);

    const form = new FormData();
    form.append('image', fs.createReadStream(tempInputImage));
    form.append('text', 'Watermark Verification');
    form.append('gravity', 'south');
    form.append('fontSize', '24');
    form.append('fontColor', '#FFFFFF');

    const overlayRes = await axios.post(`${baseUrl}/api/images/overlay-text`, form, {
      headers: form.getHeaders(),
      responseType: 'arraybuffer',
    });

    console.log('Overlay response status:', overlayRes.status);
    console.log('Content-Type header:', overlayRes.headers['content-type']);
    const verifiedMetadata = await sharp(Buffer.from(overlayRes.data)).metadata();
    console.log(`Verified returned image dimensions: ${verifiedMetadata.width}x${verifiedMetadata.height}, format: ${verifiedMetadata.format}`);

    // Clean up temporary image
    fs.unlinkSync(tempInputImage);

    // 3. Test missing parameters validation (e.g. no text provided)
    console.log('Testing missing text validation...');
    const badForm = new FormData();
    badForm.append('image', Buffer.from('fake image content'), { filename: 'test.jpg' });
    const badRes = await axios.post(`${baseUrl}/api/images/overlay-text`, badForm, {
      headers: badForm.getHeaders(),
      validateStatus: () => true,
    });
    console.log('Missing text response status:', badRes.status, 'Error message:', badRes.data.error.message);

    // 4. Test document conversion error handling when Gotenberg service is unreachable
    console.log('Testing Gotenberg offline handling...');
    const docForm = new FormData();
    docForm.append('file', Buffer.from('Mock doc content'), { filename: 'test.docx' });
    const docRes = await axios.post(`${baseUrl}/api/documents/convert`, docForm, {
      headers: docForm.getHeaders(),
      validateStatus: () => true,
    });
    console.log('Document conversion offline Gotenberg status:', docRes.status, 'Error:', docRes.data.error.message);

    console.log('--- All HTTP tests executed successfully ---');
  } finally {
    server.close();
  }
}

testHttpEndpoints().catch((err) => {
  console.error('HTTP Test failed:', err);
  process.exit(1);
});

