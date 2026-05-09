const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Replace standard favicon
const iconStartIndex = html.indexOf('<link rel="icon" type="image/png" href="data:image/png;base64,');
if (iconStartIndex !== -1) {
    const iconEndIndex = html.indexOf('>', iconStartIndex);
    const oldIcon = html.substring(iconStartIndex, iconEndIndex + 1);
    html = html.replace(oldIcon, `<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🦞</text></svg>">`);
}

// Replace apple-touch-icon
const appleStartIndex = html.indexOf('<link rel="apple-touch-icon" href="data:image/png;base64,');
if (appleStartIndex !== -1) {
    const appleEndIndex = html.indexOf('>', appleStartIndex);
    const oldApple = html.substring(appleStartIndex, appleEndIndex + 1);
    html = html.replace(oldApple, `<link rel="apple-touch-icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🦞</text></svg>">`);
}

fs.writeFileSync('index.html', html);
