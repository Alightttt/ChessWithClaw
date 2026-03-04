import fs from 'fs';
try {
  console.log(fs.readFileSync('.env', 'utf8'));
} catch (e) {
  console.log('No .env file');
}
