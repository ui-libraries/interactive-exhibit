import { loadManifest } from './loader.js'
import slides from './slides.js';
import { init3DViewer } from './3d-viewer.js';

const app = document.getElementById('app');

let currentSlide = 0;
let currentMedia = 0;

function render() {
  const slide = slides[currentSlide];
  const mediaItem = slide.media[currentMedia];

  // Media display (image or video)
  let mediaHtml = '';
  if (mediaItem.type === 'image') {
    mediaHtml = `<img src="${mediaItem.src}" alt="${slide.title}" style="max-width: 100%; max-height: 70vh; border-radius: 12px; box-shadow: none; background: #fff;" />`;
  } else if (mediaItem.type === 'video') {
    mediaHtml = `<video src="${mediaItem.src}" controls autoplay muted style="max-width: 100%; max-height: 70vh; border-radius: 12px; background: #000;" preload="auto"></video>`;
  } else if (mediaItem.type === 'youtube') {
    mediaHtml = `
      <iframe
        width="100%"
        height="500"
        src="https://www.youtube.com/embed/${mediaItem.src}?autoplay=1&controls=1&rel=0"
        title="YouTube video player"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        style="max-width: 100%; max-height: 70vh; border-radius: 12px; background: #000;"
      ></iframe>
    `;
  } else if (mediaItem.type === '3d') {
    mediaHtml = `<div id="3d-container" style="width: 100%; height: 70vh; background: #f0f0f0; border-radius: 12px;"></div>`;
  }

  // Media navigation controls (only if more than one media item)
  let mediaControls = '';
  if (slide.media.length > 1) {
    mediaControls = `
      <div class="media-controls">
        <button id="prev-media">Previous</button>
        <span>${currentMedia + 1} of ${slide.media.length}</span>
        <button id="next-media">Next</button>
      </div>
    `;
  }

  app.innerHTML = `
    <div class="split-container">
      <div class="media-side">
        <div class="media-display">
          ${mediaHtml}
        </div>
        ${mediaControls}
      </div>
      <div class="desc-side">
        <h2>${slide.title}</h2>
        <p>${slide.description}</p>
        <div class="slide-controls">
          <button id="prev-slide">Previous Work</button>
          <span>Work ${currentSlide + 1} of ${slides.length}</span>
          <button id="next-slide">Next Work</button>
        </div>
      </div>
    </div>
  `;

  // Initialize 3D viewer if needed
  if (mediaItem.type === '3d') {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      init3DViewer('3d-container', mediaItem.src);
    }, 100);
  }

  // Media navigation
  if (slide.media.length > 1) {
    document.getElementById('prev-media').onclick = () => {
      currentMedia = (currentMedia - 1 + slide.media.length) % slide.media.length;
      render();
    };
    document.getElementById('next-media').onclick = () => {
      currentMedia = (currentMedia + 1) % slide.media.length;
      render();
    };
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
