const fs = require('fs');
const path = require('path');

const logoPath = path.join(process.cwd(), 'public', 'vrgc-logo.png');
const imgBuffer = fs.readFileSync(logoPath);
const base64Data = imgBuffer.toString('base64');

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <rect width="512" height="512" rx="96" fill="#05010a"/>
  <image href="data:image/png;base64,${base64Data}" width="512" height="512" preserveAspectRatio="xMidYMid slice"/>
</svg>`;

fs.writeFileSync(path.join(process.cwd(), 'src', 'app', 'icon.svg'), svgContent);
fs.writeFileSync(path.join(process.cwd(), 'public', 'icon.svg'), svgContent);
console.log("Successfully converted vrgc-logo.png to SVG icon files!");
