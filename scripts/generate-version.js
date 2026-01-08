import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');
const publicVersionPath = path.resolve(__dirname, '../public/version.json');

try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const versionFn = { version: packageJson.version };

    fs.writeFileSync(publicVersionPath, JSON.stringify(versionFn, null, 2));
    console.log(`✅ Generated public/version.json with version ${packageJson.version}`);
} catch (error) {
    console.error('❌ Error generating version.json:', error);
    process.exit(1);
}
