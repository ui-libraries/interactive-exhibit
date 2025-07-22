export async function loadManifest(path, container) {
  const res = await fetch(path)
  const manifest = await res.json()

  for (let item of manifest) {
    switch (item.type) {
      case 'text':
        const p = document.createElement('p')
        p.textContent = item.content
        container.appendChild(p)
        break
      case 'video':
        const v = document.createElement('video')
        v.src = item.src
        v.controls = true
        v.autoplay = true
        v.loop = true
        v.style.width = '100%'
        container.appendChild(v)
        break
      case 'gif':
        const img = document.createElement('img')
        img.src = item.src
        container.appendChild(img)
        break
      case '3d':
        // You can plug in Three.js or Babylon.js here
        load3DModel(item.src, container)
        break
    }
  }
}

function load3DModel(src, container) {
  // Placeholder – real implementation would use Three.js
  const msg = document.createElement('p')
  msg.textContent = `3D model at ${src}`
  container.appendChild(msg)
}
