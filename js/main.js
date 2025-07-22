import { loadManifest } from './loader.js'
import slides from './slides.js';

const app = document.getElementById('app');

let currentSlide = 0;
let currentImage = 0;

function render() {
  const slide = slides[currentSlide];
  const imageSrc = slide.images[currentImage];
  app.innerHTML = `
    <div class="slide">
      <h2>${slide.title}</h2>
      <p>${slide.text}</p>
      <div class="image-container">
        <img src="${imageSrc}" alt="${slide.title}" style="max-width: 80vw; max-height: 60vh; display: block; margin: 0 auto;" />
        <div class="image-controls">
          <button id="prev-image">Previous Image</button>
          <span>Image ${currentImage + 1} of ${slide.images.length}</span>
          <button id="next-image">Next Image</button>
        </div>
      </div>
      <div class="slide-controls">
        <button id="prev-slide">Previous Slide</button>
        <span>Slide ${currentSlide + 1} of ${slides.length}</span>
        <button id="next-slide">Next Slide</button>
      </div>
    </div>
  `;

  // Image navigation
  document.getElementById('prev-image').onclick = () => {
    currentImage = (currentImage - 1 + slide.images.length) % slide.images.length;
    render();
  };
  document.getElementById('next-image').onclick = () => {
    currentImage = (currentImage + 1) % slide.images.length;
    render();
  };

  // Slide navigation
  document.getElementById('prev-slide').onclick = () => {
    currentSlide = (currentSlide - 1 + slides.length) % slides.length;
    currentImage = 0;
    render();
  };
  document.getElementById('next-slide').onclick = () => {
    currentSlide = (currentSlide + 1) % slides.length;
    currentImage = 0;
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
