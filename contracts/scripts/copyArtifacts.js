const fs = require('fs');
const path = require('path');

const contracts = ['SimpleNFT', 'EscbaseToken'];

const srcDir = path.join(__dirname, '..', 'artifacts', 'contracts');
const outDir = path.join(__dirname, '..', '..', 'frontend', 'src', 'artifacts');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

for (const name of contracts) {
  const contractPath = path.join(srcDir, `${name}.sol`, `${name}.json`);
  if (!fs.existsSync(contractPath)) {
    console.error(`Artifact not found for ${name} at ${contractPath}. Did you run 'npm run compile'?`);
    process.exitCode = 1;
    continue;
  }
  const destPath = path.join(outDir, `${name}.json`);
  fs.copyFileSync(contractPath, destPath);
  console.log(`Copied ${name} → ${destPath}`);
}


