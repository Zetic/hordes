const fs = require('fs');

const content = fs.readFileSync('./src/commands/search.ts', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  // Check for apostrophes that aren't escaped
  const regex = /(?<!')'/g;
  if (regex.test(line)) {
    console.log(`Line ${index + 1}: ${line}`);
  }
});