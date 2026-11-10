/**
 * XML-escapes text to safely inject inside SVG nodes.
 * @param {string} str
 * @returns {string}
 */
const escapeXml = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Creates an SVG buffer containing styled text with optional background pill/box.
 * @param {Object} options
 * @param {string} options.text - Raw text string (supports newline \n)
 * @param {number} options.imageWidth - Width of the base image (for boundary clamping)
 * @param {number} options.imageHeight - Height of the base image
 * @param {number} [options.fontSize=36] - Font size in pixels
 * @param {string} [options.fontColor='#ffffff'] - Hex or CSS color
 * @param {string} [options.fontFamily='sans-serif'] - Font family
 * @param {string} [options.fontWeight='bold'] - Font weight (normal, bold, 600, etc.)
 * @param {string} [options.backgroundColor='rgba(0,0,0,0.5)'] - Background box color (empty string for none)
 * @param {number} [options.padding=16] - Padding inside the background box
 * @param {number} [options.borderRadius=8] - Corner radius for background box
 * @param {number} [options.strokeWidth=0] - Text stroke outline width
 * @param {string} [options.strokeColor='#000000'] - Text stroke outline color
 * @returns {{ svgBuffer: Buffer, width: number, height: number }}
 */
const createTextOverlaySvg = ({
  text,
  imageWidth,
  imageHeight,
  fontSize = 36,
  fontColor = '#ffffff',
  fontFamily = 'sans-serif',
  fontWeight = 'bold',
  backgroundColor = 'rgba(0,0,0,0.6)',
  padding = 16,
  borderRadius = 8,
  strokeWidth = 0,
  strokeColor = '#000000',
}) => {
  const lines = (text || '').split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) {
    lines.push('');
  }

  const safeLines = lines.map(escapeXml);
  const lineHeight = fontSize * 1.25;

  // Approximate line width (assuming average character width ~ 0.58 of font size for standard sans-serif)
  const maxLineLength = Math.max(...lines.map((l) => l.length), 1);
  const approxTextWidth = Math.ceil(maxLineLength * (fontSize * 0.58));
  const approxTextHeight = Math.ceil(lines.length * lineHeight);

  const boxWidth = Math.min(approxTextWidth + padding * 2, imageWidth || approxTextWidth + padding * 2);
  const boxHeight = approxTextHeight + padding * 2;

  // Build <text> tspans
  const tspans = safeLines
    .map((line, idx) => {
      const yOffset = padding + fontSize + idx * lineHeight - (lineHeight - fontSize) / 2;
      return `<tspan x="50%" y="${yOffset}" text-anchor="middle">${line}</tspan>`;
    })
    .join('\n');

  const strokeAttr =
    strokeWidth > 0
      ? `stroke="${escapeXml(strokeColor)}" stroke-width="${strokeWidth}" paint-order="stroke fill"`
      : '';

  const backgroundRect =
    backgroundColor && backgroundColor.trim() !== 'transparent'
      ? `<rect width="100%" height="100%" rx="${borderRadius}" ry="${borderRadius}" fill="${escapeXml(
          backgroundColor
        )}" />`
      : '';

  const svg = `
    <svg width="${boxWidth}" height="${boxHeight}" viewBox="0 0 ${boxWidth} ${boxHeight}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .overlay-text {
          font-family: ${escapeXml(fontFamily)};
          font-size: ${fontSize}px;
          font-weight: ${escapeXml(fontWeight)};
          fill: ${escapeXml(fontColor)};
          dominant-baseline: alphabetic;
        }
      </style>
      ${backgroundRect}
      <text class="overlay-text" ${strokeAttr}>
        ${tspans}
      </text>
    </svg>
  `.trim();

  return {
    svgBuffer: Buffer.from(svg),
    width: boxWidth,
    height: boxHeight,
  };
};

module.exports = {
  escapeXml,
  createTextOverlaySvg,
};

