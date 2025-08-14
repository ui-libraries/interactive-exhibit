import { loadManifest } from './loader.js'
import slides from './slides.js';
async function ensureMeshoptReady() {
  if (typeof window !== 'undefined' && (window.MeshoptDecoder || window.meshopt_decoder)) {
    const dec = window.MeshoptDecoder || window.meshopt_decoder;
    if (dec && dec.ready && typeof dec.ready.then === 'function') {
      await dec.ready;
    }
    window.MeshoptDecoder = dec;
    return;
  }
  try {
    const mod = await import('https://unpkg.com/three@0.128.0/examples/jsm/libs/meshopt_decoder.module.js');
    const dec = mod.MeshoptDecoder;
    if (dec && dec.ready && typeof dec.ready.then === 'function') {
      await dec.ready;
    }
    window.MeshoptDecoder = dec;
  } catch (_) {}
}

const app = document.getElementById('app');

let currentSlide = 0;
let currentMedia = 0;

// Preload 3D models (HTTP only to warm browser cache)
async function preload3DModels() {
  console.log('[App] Starting 3D model preload...');
  let preloadCount = 0;
  for (const slide of slides) {
    for (const mediaItem of slide.media) {
      if (mediaItem.type === '3d') {
        preloadCount++;
        console.log(`[App] Preloading 3D model ${preloadCount}:`, mediaItem.src);
        try {
          await fetch(mediaItem.src, { cache: 'reload' });
          console.log('[App] Successfully preloaded 3D model:', mediaItem.src);
        } catch (error) {
          console.error('[App] Failed to preload 3D model:', mediaItem.src, error);
        }
      }
    }
  }
  console.log(`[App] 3D model preload complete. Processed ${preloadCount} models.`);
}

function render() {
  const slide = slides[currentSlide];
  const mediaItem = slide.media[currentMedia];
  const absoluteMediaUrl = (() => {
    try {
      const base = window.location.origin;
      const path = mediaItem.src.startsWith('http') ? mediaItem.src : `${base}/${mediaItem.src}`;
      return encodeURIComponent(path);
    } catch (_) {
      return encodeURIComponent(mediaItem.src);
    }
  })();

  // Media display (image or video)
  let mediaHtml = '';
  if (mediaItem.type === 'image') {
    mediaHtml = `<img class="media-asset" src="${mediaItem.src}" alt="${slide.title}" />`;
          } else if (mediaItem.type === 'video') {
          const loopAttr = mediaItem.loop ? 'loop' : '';
          const volumeAttr = mediaItem.src.includes('thedeep.mp4') ? 'data-volume="0.7"' : '';
          mediaHtml = `<video class="media-asset" src="${mediaItem.src}" controls autoplay preload="auto" width="100%" height="100%" ${loopAttr} ${volumeAttr}></video>`;
  } else if (mediaItem.type === 'youtube') {
    mediaHtml = `
      <iframe
        class="media-asset"
        width="100%"
        height="100%"
        src="https://www.youtube.com/embed/${mediaItem.src}?autoplay=1&controls=1&rel=0"
        title="YouTube video player"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    `;
  } else if (mediaItem.type === '3d') {
    const cropTopPx = 56;
    const cropBottomPx = 64;
    const cropTotalPx = cropTopPx + cropBottomPx;
    mediaHtml = `
      <div style="position:relative;width:100%;height:100%;overflow:hidden;background:#f0f0f0;border-radius:4px;">
        <iframe
          class="media-asset"
          style="position:absolute;top:-${cropTopPx}px;left:0;width:100%;height:calc(100% + ${cropTotalPx}px);border:0;background:#f0f0f0;"
          src="https://gltf-viewer.donmccurdy.com/#model=${absoluteMediaUrl}&kiosk=1"
          allow="autoplay; fullscreen"
        ></iframe>
        <div style="position:absolute;right:12px;bottom:12px;padding:6px 10px;background:rgba(0,0,0,0.55);color:#fff;font:500 12px/1.3 system-ui, -apple-system, Segoe UI, Roboto, Arial;border-radius:4px;">
          Drag: Rotate · Pinch/Wheel: Zoom
        </div>
      </div>
    `;
  }

  // Media navigation controls (only if more than one media item)
  let mediaControls = '';
  if (slide.media.length > 1) {
    mediaControls = `
      <div class="media-controls">
        <button id="prev-media">
          <img src="assets/images/back-button.svg" alt="Previous" />
        </button>
        <span class="counter">${currentMedia + 1} of ${slide.media.length}</span>
        <button id="next-media">
          <img src="assets/images/next-button.svg" alt="Next" />
        </button>
      </div>
    `;
  }

  app.innerHTML = `
    <div class="split-container">
      <div class="logo-container">
        <img src="assets/images/logo.png" alt="Logo" />
      </div>
      <div class="media-side">
        <div class="media-display">
          ${mediaHtml}
        </div>
        <div class="desc-container">
          <button id="prev-slide">
            <img src="assets/images/back-button.svg" alt="Previous Work" />
          </button>
          <div class="desc-content">
            <h2>${slide.title}</h2>
            <p>${slide.description}</p>
            <div class="slide-controls">
              <span class="counter">Work ${currentSlide + 1} of ${slides.length}</span>
            </div>
          </div>
          <button id="next-slide">
            <img src="assets/images/next-button.svg" alt="Next Work" />
          </button>
        </div>
      </div>
    </div>
  `;

  // No JS init needed for model-viewer
  
  // Set volume for specific videos after they load
  if (mediaItem.type === 'video') {
    setTimeout(() => {
      const video = document.querySelector('.media-asset');
      if (video && video.tagName === 'VIDEO') {
        if (mediaItem.src.includes('thedeep.mp4')) {
          video.volume = 0.7; // 30% lower volume
        }
      }
    }, 200);
  }

  // Slide navigation
  document.getElementById('prev-slide').onclick = () => {
    currentSlide = (currentSlide - 1 + slides.length) % slides.length;
    currentMedia = 0;
    render();
  };
  document.getElementById('next-slide').onclick = () => {
    currentSlide = (currentSlide + 1) % slides.length;
    currentMedia = 0;
    render();
  };
}

ensureMeshoptReady().then(render).catch(render);

loadManifest('/manifest.json', app)

// Preload 3D models in the background
preload3DModels().catch(console.error);

// Add keyboard shortcut to quit NW.js app during development
if (typeof nw !== "undefined") {
  document.addEventListener("keydown", function(e) {
    // Cmd+Q or Ctrl+Q
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "q") {
      nw.App.quit();
    }
    // Escape key
    if (e.key === "Escape") {
      nw.App.quit();
    }
  });
}
