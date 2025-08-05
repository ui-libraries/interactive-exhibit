// 3D Viewer for OBJ files using Three.js
// Note: This requires Three.js to be loaded separately

export function init3DViewer(containerId, modelPath) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Check if Three.js is available
  if (typeof THREE === 'undefined') {
    console.error('Three.js not loaded. Please include three.min.js');
    container.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Three.js not loaded. Please include the Three.js library.</p>';
    return;
  }
  
  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);
  
  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0xf0f0f0);
  container.appendChild(renderer.domElement);
  
  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);
  
  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
  directionalLight2.position.set(-1, -1, -1);
  scene.add(directionalLight2);
  
  // Load the OBJ file
  const loader = new THREE.OBJLoader();
  
  // Show loading message
  container.innerHTML = '<p style="text-align: center; padding: 20px;">Loading 3D model...</p>';
  
  let object; // Store reference to the loaded object
  let initialDistance = 10; // Initial camera distance
  let currentDistance = initialDistance;
  
  // Touch variables for pinch zoom
  let initialPinchDistance = 0;
  let initialPinchZoom = 0;
  
  loader.load(
    modelPath,
    (loadedObject) => {
      // Clear loading message and add renderer
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      
      object = loadedObject;
      scene.add(object);
      
      // Center and scale the object
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 5 / maxDim;
      object.scale.setScalar(scale);
      object.position.sub(center.multiplyScalar(scale));
      
      camera.position.z = currentDistance;
      
      // Animation loop
      function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
      }
      animate();
      
      // Mouse controls for rotation
      let isMouseDown = false;
      let mouseX = 0, mouseY = 0;
      
      container.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        mouseX = e.clientX;
        mouseY = e.clientY;
      });
      
      container.addEventListener('mouseup', () => {
        isMouseDown = false;
      });
      
      container.addEventListener('mousemove', (e) => {
        if (isMouseDown) {
          const deltaX = e.clientX - mouseX;
          const deltaY = e.clientY - mouseY;
          
          // Rotate the object
          object.rotation.y += deltaX * 0.01;
          object.rotation.x += deltaY * 0.01;
          
          mouseX = e.clientX;
          mouseY = e.clientY;
        }
      });
      
      // Mouse wheel zoom
      container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const zoomDelta = e.deltaY > 0 ? 1 : -1;
        
        currentDistance += zoomDelta * zoomSpeed * currentDistance;
        currentDistance = Math.max(2, Math.min(50, currentDistance)); // Clamp zoom range
        
        camera.position.z = currentDistance;
      });
      
      // Touch controls for mobile
      let touchStartX = 0, touchStartY = 0;
      let touchCount = 0;
      
      container.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchCount = e.touches.length;
        
        if (touchCount === 1) {
          // Single touch - rotation
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        } else if (touchCount === 2) {
          // Two touches - pinch zoom
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          initialPinchDistance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
          );
          initialPinchZoom = currentDistance;
        }
      });
      
      container.addEventListener('touchend', (e) => {
        touchCount = 0;
      });
      
      container.addEventListener('touchmove', (e) => {
        e.preventDefault();
        
        if (touchCount === 1) {
          // Single touch - rotate
          const deltaX = e.touches[0].clientX - touchStartX;
          const deltaY = e.touches[0].clientY - touchStartY;
          
          object.rotation.y += deltaX * 0.01;
          object.rotation.x += deltaY * 0.01;
          
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        } else if (touchCount === 2) {
          // Two touches - pinch zoom
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          const currentPinchDistance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
          );
          
          if (initialPinchDistance > 0) {
            const pinchRatio = initialPinchDistance / currentPinchDistance;
            currentDistance = initialPinchZoom * pinchRatio;
            currentDistance = Math.max(2, Math.min(50, currentDistance)); // Clamp zoom range
            camera.position.z = currentDistance;
          }
        }
      });
      
      // Keyboard controls for zoom
      document.addEventListener('keydown', (e) => {
        if (container.contains(document.activeElement) || container === document.activeElement) {
          const zoomSpeed = 0.5;
          
          if (e.key === 'z' || e.key === 'Z') {
            // Zoom in
            currentDistance -= zoomSpeed;
            currentDistance = Math.max(2, currentDistance);
            camera.position.z = currentDistance;
          } else if (e.key === 'x' || e.key === 'X') {
            // Zoom out
            currentDistance += zoomSpeed;
            currentDistance = Math.min(50, currentDistance);
            camera.position.z = currentDistance;
          }
        }
      });
      
      // Add zoom instructions
      const instructions = document.createElement('div');
      instructions.style.cssText = `
        position: absolute;
        bottom: 10px;
        left: 10px;
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        pointer-events: none;
      `;
      instructions.innerHTML = 'Drag: Rotate | Pinch: Zoom | Mouse wheel: Zoom | Z/X: Zoom';
      container.appendChild(instructions);
    },
    (progress) => {
      // Loading progress
      console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
    },
    (error) => {
      console.error('Error loading 3D model:', error);
      container.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Error loading 3D model. Please check the file path.</p>';
    }
  );
} 