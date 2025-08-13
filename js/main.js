import { loadManifest } from './loader.js'
import slides from './slides.js';
import { init3DViewer, preload3DModel } from './3d-viewer.js';

const app = document.getElementById('app');

let currentSlide = 0;
let currentMedia = 0;

// Preload 3D models
async function preload3DModels() {
  console.log('[App] Starting 3D model preload...');
  let preloadCount = 0;
  for (const slide of slides) {
    for (const mediaItem of slide.media) {
      if (mediaItem.type === '3d') {
        preloadCount++;
        console.log(`[App] Preloading 3D model ${preloadCount}:`, mediaItem.src);
        try {
          await preload3DModel(mediaItem.src);
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
    mediaHtml = `
      <div id="3d-container" class="three-container">
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: white;">
          <div style="width: 50px; height: 50px; border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid white; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
          <div style="font-size: 18px; font-weight: 500;">Loading 3D Model...</div>
          <div style="font-size: 14px; opacity: 0.8; margin-top: 8px;">This may take a few moments</div>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
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

  // Initialize 3D viewer if needed
  if (mediaItem.type === '3d') {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      console.log('[App] Initializing 3D viewer for:', mediaItem.src);
      init3DViewer('3d-container', mediaItem.src);
    }, 100);
  }
  
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

render();

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
