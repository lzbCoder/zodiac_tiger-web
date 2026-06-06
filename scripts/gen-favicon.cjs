const sharp = require('sharp')
const path = require('path')
const fs = require('fs')
const toIco = require('to-ico')
const pub = path.join(__dirname, '..', 'public')

async function main() {
  const sizes = [16, 32]
  const pngs = []

  for (const size of sizes) {
    const buf = await sharp(path.join(pub, 'favicon.svg'))
      .resize(size, size)
      .png()
      .toBuffer()
    const outPath = path.join(pub, `favicon-${size}x${size}.png`)
    fs.writeFileSync(outPath, buf)
    pngs.push(buf)
    console.log(`  favicon-${size}x${size}.png`)
  }

  // Generate multi-size .ico (contains both 16 and 32)
  const icoBuf = await toIco(pngs)
  fs.writeFileSync(path.join(pub, 'favicon.ico'), icoBuf)
  console.log('  favicon.ico (16+32)')

  console.log('All favicons generated OK')
}

main().catch(e => {
  console.error('Error:', e.message)
  process.exit(1)
})
