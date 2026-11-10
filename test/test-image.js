const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const imageService = require('../src/services/image.service');

async function testImageProcessing() {
  console.log('--- Starting Sharp Image Processing Test ---');

  // 1. Generate a test image (800x600 solid blue canvas)
  const testImagePath = path.join(__dirname, 'test_input.png');
  await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 4,
      background: { r: 50, g: 120, b: 220, alpha: 1 },
    },
  })
    .png()
    .toFile(testImagePath);

  console.log('Created test image at:', testImagePath);

  // 2. Process with text overlay
  const result = await imageService.applyTextOverlay({
    filePath: testImagePath,
    text: 'Zunvox Production\nText Overlay Test',
    options: {
      gravity: 'center',
      fontSize: 32,
      fontColor: '#FFFFFF',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      format: 'png',
    },
  });

  const testOutputPath = path.join(__dirname, 'test_output.png');
  const writeStream = fs.createWriteStream(testOutputPath);

  await new Promise((resolve, reject) => {
    result.stream.pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    result.stream.on('error', reject);
  });

  const outputMetadata = await sharp(testOutputPath).metadata();
  console.log('Processed image generated successfully!');
  console.log('Output dimensions:', `${outputMetadata.width}x${outputMetadata.height}`);
  console.log('Output format:', outputMetadata.format);

  // Clean up test files
  fs.unlinkSync(testImagePath);
  fs.unlinkSync(testOutputPath);
  console.log('--- Test passed successfully ---');
}

testImageProcessing().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

