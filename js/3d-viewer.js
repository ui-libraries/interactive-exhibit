// 3D Viewer for OBJ and GLB/GLTF files using Three.js
// Note: This requires Three.js to be loaded separately

// Cache for loaded 3D models
const modelCache = new Map();

// Ensure external loader scripts exist and build a configured GLTFLoader
function ensureScriptLoaded(src) {
  return new Promise((resolve, reject) => {
    const existing = Array.from(document.scripts).find((s) => s.src === src);
    if (existing) {
      // If a matching script tag exists, assume it's already executed
      return resolve();
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureAnyScriptLoaded(urls) {
  let lastError = null;
  for (const url of urls) {
    try {
      await ensureScriptLoaded(url);
      return true;
    } catch (e) {
      lastError = e;
    }
  }
  if (lastError) throw lastError;
  return false;
}

async function ensureModelViewerLoaded() {
  const tag = 'script[data-model-viewer]';
  if (document.querySelector(tag)) return true;
  try {
    // 1) Ensure Meshopt decoder is present for meshopt-compressed GLBs
    if (typeof window.MeshoptDecoder === 'undefined') {
      const m = document.createElement('script');
      m.src = 'https://unpkg.com/meshoptimizer@0.18.1/meshopt_decoder.js';
      await new Promise((res, rej) => { m.onload = res; m.onerror = rej; document.head.appendChild(m); });
      // Ensure global is assigned in all builds
      try {
        const g = window;
        if (!g.MeshoptDecoder && g.meshopt_decoder) g.MeshoptDecoder = g.meshopt_decoder;
        if (!g.MeshoptDecoder && typeof MeshoptDecoder !== 'undefined') g.MeshoptDecoder = MeshoptDecoder;
      } catch (_) {}
    }
    // 2) Load UMD build of model-viewer (non-module) to avoid ESM issues
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@google/model-viewer@3.3.0/dist/model-viewer-umd.js';
    script.setAttribute('data-model-viewer', 'true');
    await new Promise((res, rej) => { script.onload = res; script.onerror = rej; document.head.appendChild(script); });
    return true;
  } catch (_) {
    return false;
  }
}

let sharedGLTFLoader = null;

async function configureLoaderExtensions(loader, renderer) {
  // KTX2
  const KTX2LoaderCtor = (typeof THREE !== 'undefined' && THREE.KTX2Loader) || (typeof window !== 'undefined' && window.KTX2Loader) || null;
  if (!loader.ktx2Loader && KTX2LoaderCtor) {
    const ktx2 = new KTX2LoaderCtor()
      .setTranscoderPath('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/libs/basis/')
      .detectSupport(renderer);
    loader.setKTX2Loader(ktx2);
  }
  // Draco
  const DRACOLoaderCtor = (typeof THREE !== 'undefined' && THREE.DRACOLoader) || (typeof window !== 'undefined' && window.DRACOLoader) || null;
  if (DRACOLoaderCtor && !loader.dracoLoader) {
    const draco = new DRACOLoaderCtor().setDecoderPath('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/libs/draco/');
    loader.setDRACOLoader(draco);
  }
  // Meshopt
  if (typeof loader.setMeshoptDecoder === 'function') {
    let meshopt = (typeof window !== 'undefined' && (window.MeshoptDecoder || window.meshopt_decoder)) || null;
    if (meshopt) {
      try { if (meshopt.ready && typeof meshopt.ready.then === 'function') await meshopt.ready; } catch (_) {}
      loader.setMeshoptDecoder(meshopt);
    }
  }
}

async function createConfiguredGLTFLoader(renderer) {
  if (typeof THREE === 'undefined') {
    return null;
  }
  // Prefer already-loaded constructors; do not fetch from network here
  if (typeof THREE.GLTFLoader === 'undefined' && typeof window !== 'undefined' && typeof window.GLTFLoader !== 'undefined') {
    // Some builds attach to window, copy onto THREE for consistency
    THREE.GLTFLoader = window.GLTFLoader;
  }
  if (typeof THREE.GLTFLoader === 'undefined') {
    return null;
  }

  // Dynamically load KTX2Loader if it isn't available yet
  let hasKTX2OnTHREE = typeof THREE.KTX2Loader !== 'undefined';
  let hasKTX2OnWindow = typeof window !== 'undefined' && typeof window.KTX2Loader !== 'undefined';
  if (!hasKTX2OnTHREE && hasKTX2OnWindow) {
    THREE.KTX2Loader = window.KTX2Loader;
  }

  const loader = new THREE.GLTFLoader();
  // Force-enable KHR_texture_basisu extension in parser once KTX2 is set

  await configureLoaderExtensions(loader, renderer);

  // Ensure Meshopt/Draco ready too (uses already-loaded globals if any)
  await configureLoaderExtensions(loader, renderer);

  return loader;
}

async function getSharedGLTFLoader(renderer) {
  if (!sharedGLTFLoader) {
    sharedGLTFLoader = await createConfiguredGLTFLoader(renderer);
  }
  // Reconfigure on every access in case decoders became available after first creation
  if (sharedGLTFLoader) {
    await configureLoaderExtensions(sharedGLTFLoader, renderer);
  }
  return sharedGLTFLoader;
}

export function init3DViewer(containerId, modelPath) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Check if Three.js is available
  if (typeof THREE === 'undefined') {
    console.error('Three.js not loaded. Please include three.min.js');
    container.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Three.js not loaded. Please include the Three.js library.</p>';
    return;
  }
  
  // Check if model is already cached
  if (modelCache.has(modelPath)) {
    console.log('[3D] Using cached model:', modelPath);
    const cachedData = modelCache.get(modelPath);
    
    // Create new scene, camera, renderer for this instance
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    if ('outputEncoding' in renderer && THREE.sRGBEncoding) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0xf0f0f0);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-1, -1, -1);
    scene.add(directionalLight2);
    
    // Clear container and add renderer immediately
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    
    // Clone and add the cached object
    const clonedObject = cachedData.object.clone();
    scene.add(clonedObject);
    
    // Set up camera and start rendering immediately
    camera.position.z = 2; // Start much closer to the model
    
    // Start animation loop
    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();
    
    // Set up controls
    let isMouseDown = false;
    let mouseX = 0, mouseY = 0;
    let currentDistance = 2; // Start much closer

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

        clonedObject.rotation.y += deltaX * 0.01;
        clonedObject.rotation.x += deltaY * 0.01;

        mouseX = e.clientX;
        mouseY = e.clientY;
      }
    });

    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomSpeed = 0.1;
      const zoomDelta = e.deltaY > 0 ? 1 : -1;

      currentDistance += zoomDelta * zoomSpeed * currentDistance;
      currentDistance = Math.max(0.5, Math.min(15, currentDistance)); // Allow even closer zoom

      camera.position.z = currentDistance;
    });

    let touchStartX = 0, touchStartY = 0;
    let touchCount = 0;
    let initialPinchDistance = 0;
    let initialPinchZoom = 0;

    container.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchCount = e.touches.length;

      if (touchCount === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      } else if (touchCount === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialPinchDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        initialPinchZoom = currentDistance;
      }
    });

    container.addEventListener('touchend', () => {
      touchCount = 0;
    });

    container.addEventListener('touchmove', (e) => {
      e.preventDefault();

      if (touchCount === 1) {
        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;

        clonedObject.rotation.y += deltaX * 0.01;
        clonedObject.rotation.x += deltaY * 0.01;

        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      } else if (touchCount === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentPinchDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );

        if (initialPinchDistance > 0) {
          const pinchRatio = initialPinchDistance / currentPinchDistance;
          currentDistance = initialPinchZoom * pinchRatio;
          currentDistance = Math.max(0.5, Math.min(15, currentDistance)); // Allow even closer zoom
          camera.position.z = currentDistance;
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (container.contains(document.activeElement) || container === document.activeElement) {
        const zoomSpeed = 0.5;

        if (e.key === 'z' || e.key === 'Z') {
          currentDistance -= zoomSpeed;
          currentDistance = Math.max(0.5, currentDistance); // Allow even closer zoom
          camera.position.z = currentDistance;
        } else if (e.key === 'x' || e.key === 'X') {
          currentDistance += zoomSpeed;
          currentDistance = Math.min(15, currentDistance); // Limit max distance
          camera.position.z = currentDistance;
        }
      }
    });

    const instructions = document.createElement('div');
    instructions.className = 'viewer-hint';
    instructions.innerHTML = 'Drag: Rotate | Pinch: Zoom | Mouse wheel: Zoom | Z/X: Zoom';
    container.appendChild(instructions);
    
    console.log('[3D] Cached model loaded instantly');
    return;
  }
  
  console.log('[3D] Model not cached, loading:', modelPath);
  
  // Show loading spinner
  container.innerHTML = `
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
  `;
  
  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);
  
  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  if ('outputEncoding' in renderer && THREE.sRGBEncoding) {
    renderer.outputEncoding = THREE.sRGBEncoding;
  }
  
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0xf0f0f0);
  
  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);
  
  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
  directionalLight2.position.set(-1, -1, -1);
  scene.add(directionalLight2);
  
  // Loaders (lazy)
  let objLoader = null;
  let mtlLoader = null;
  let gltfLoader = null;
  
  // Global debug for asset load errors
  const manager = THREE.DefaultLoadingManager;
  manager.onError = (url) => console.warn('[3D] Asset load error:', url);
  
  async function getObjLoader() {
    if (objLoader) return objLoader;
    let OBJLoaderCtor = (typeof THREE !== 'undefined' && THREE.OBJLoader) || (typeof window !== 'undefined' && window.OBJLoader) || null;
    if (!OBJLoaderCtor) {
      await ensureScriptLoaded('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/loaders/OBJLoader.js');
      OBJLoaderCtor = (typeof THREE !== 'undefined' && THREE.OBJLoader) || (typeof window !== 'undefined' && window.OBJLoader) || null;
      if (!OBJLoaderCtor && typeof window !== 'undefined' && typeof window.OBJLoader !== 'undefined') {
        THREE.OBJLoader = window.OBJLoader;
        OBJLoaderCtor = THREE.OBJLoader;
      }
    }
    if (!OBJLoaderCtor) return null;
    objLoader = new OBJLoaderCtor();
    return objLoader;
  }

  async function getMtlLoader() {
    if (mtlLoader) return mtlLoader;
    let MTLLoaderCtor = (typeof THREE !== 'undefined' && THREE.MTLLoader) || (typeof window !== 'undefined' && window.MTLLoader) || null;
    if (!MTLLoaderCtor) {
      await ensureScriptLoaded('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/loaders/MTLLoader.js');
      MTLLoaderCtor = (typeof THREE !== 'undefined' && THREE.MTLLoader) || (typeof window !== 'undefined' && window.MTLLoader) || null;
      if (!MTLLoaderCtor && typeof window !== 'undefined' && typeof window.MTLLoader !== 'undefined') {
        THREE.MTLLoader = window.MTLLoader;
        MTLLoaderCtor = THREE.MTLLoader;
      }
    }
    if (!MTLLoaderCtor) return null;
    mtlLoader = new MTLLoaderCtor();
    return mtlLoader;
  }
  
  // Define finalizeWithObject function for loading
  const finalizeWithObject = (container, loadedObject, scene, camera, renderer) => {
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const object = loadedObject;
    scene.add(object);
    
    // Ensure visibility of thin geometry and proper material setup
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 8;
    object.traverse((node) => {
      if (node && node.isMesh) {
        const material = node.material;
        if (Array.isArray(material)) {
          material.forEach((m) => {
            if (m && 'side' in m) m.side = THREE.DoubleSide;
            if (m && m.map && 'encoding' in m.map && THREE.sRGBEncoding) m.map.encoding = THREE.sRGBEncoding;
            if (m && m.map && 'anisotropy' in m.map) m.map.anisotropy = maxAnisotropy;
            if (m) m.needsUpdate = true;
          });
        } else if (material) {
          if ('side' in material) material.side = THREE.DoubleSide;
          if (material.map && 'encoding' in material.map && THREE.sRGBEncoding) material.map.encoding = THREE.sRGBEncoding;
          if (material.map && 'anisotropy' in material.map) material.map.anisotropy = maxAnisotropy;
          material.needsUpdate = true;
        }
      }
    });

    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 5 / maxDim;
    object.scale.setScalar(scale);
    object.position.sub(center.multiplyScalar(scale));

    camera.position.z = 2; // Start much closer to the model

    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    let isMouseDown = false;
    let mouseX = 0, mouseY = 0;
    let currentDistance = 2; // Start much closer

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

        object.rotation.y += deltaX * 0.01;
        object.rotation.x += deltaY * 0.01;

        mouseX = e.clientX;
        mouseY = e.clientY;
      }
    });

    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomSpeed = 0.1;
      const zoomDelta = e.deltaY > 0 ? 1 : -1;

      currentDistance += zoomDelta * zoomSpeed * currentDistance;
      currentDistance = Math.max(0.5, Math.min(15, currentDistance)); // Allow even closer zoom

      camera.position.z = currentDistance;
    });

    let touchStartX = 0, touchStartY = 0;
    let touchCount = 0;
    let initialPinchDistance = 0;
    let initialPinchZoom = 0;

    container.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchCount = e.touches.length;

      if (touchCount === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      } else if (touchCount === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialPinchDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        initialPinchZoom = currentDistance;
      }
    });

    container.addEventListener('touchend', () => {
      touchCount = 0;
    });

    container.addEventListener('touchmove', (e) => {
      e.preventDefault();

      if (touchCount === 1) {
        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;

        object.rotation.y += deltaX * 0.01;
        object.rotation.x += deltaY * 0.01;

        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      } else if (touchCount === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentPinchDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );

        if (initialPinchDistance > 0) {
          const pinchRatio = initialPinchDistance / currentPinchDistance;
          currentDistance = initialPinchZoom * pinchRatio;
          currentDistance = Math.max(0.5, Math.min(15, currentDistance)); // Allow even closer zoom
          camera.position.z = currentDistance;
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (container.contains(document.activeElement) || container === document.activeElement) {
        const zoomSpeed = 0.5;

        if (e.key === 'z' || e.key === 'Z') {
          currentDistance -= zoomSpeed;
          currentDistance = Math.max(0.5, currentDistance); // Allow even closer zoom
          camera.position.z = currentDistance;
        } else if (e.key === 'x' || e.key === 'X') {
          currentDistance += zoomSpeed;
          currentDistance = Math.min(15, currentDistance); // Limit max distance
          camera.position.z = currentDistance;
        }
      }
    });

    const instructions = document.createElement('div');
    instructions.className = 'viewer-hint';
    instructions.innerHTML = 'Drag: Rotate | Pinch: Zoom | Mouse wheel: Zoom | Z/X: Zoom';
    container.appendChild(instructions);
  };
      
  const loadGLTF = async () => {
    if (typeof THREE.GLTFLoader === 'undefined') {
      // Fallback: render via <model-viewer> to unblock textures flow
      const ok = await ensureModelViewerLoaded();
      if (ok) {
        container.innerHTML = '';
        const mv = document.createElement('model-viewer');
        mv.setAttribute('src', modelPath);
        mv.setAttribute('style', 'width:100%;height:100%;background:#f0f0f0');
        mv.setAttribute('camera-controls', '');
        mv.setAttribute('exposure', '1');
        mv.setAttribute('interaction-prompt', 'none');
        container.appendChild(mv);
        return;
      }
      console.error('GLTFLoader not available');
      container.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">GLTF loader unavailable. Ensure GLTFLoader.js is loaded.</p>';
      return;
    }
    const loader = new THREE.GLTFLoader();
    // Ensure KTX2 is set on THIS instance before load
    let KTX2Ctor = (THREE && THREE.KTX2Loader) || (typeof window !== 'undefined' && window.KTX2Loader) || null;
    if (!KTX2Ctor) {
      try {
        await ensureAnyScriptLoaded([
          'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/loaders/KTX2Loader.js',
          'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/KTX2Loader.js'
        ]);
        KTX2Ctor = (THREE && THREE.KTX2Loader) || (typeof window !== 'undefined' && window.KTX2Loader) || null;
      } catch (_) {}
    }
    if (KTX2Ctor && typeof loader.setKTX2Loader === 'function') {
      const ktx2 = new KTX2Ctor().setTranscoderPath('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/libs/basis/').detectSupport(renderer);
      loader.setKTX2Loader(ktx2);
    }
    // Draco
    const DracoCtor = (THREE && THREE.DRACOLoader) || (typeof window !== 'undefined' && window.DRACOLoader) || null;
    if (DracoCtor && typeof loader.setDRACOLoader === 'function') {
      const draco = new DracoCtor().setDecoderPath('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/libs/draco/');
      loader.setDRACOLoader(draco);
    }
    // Meshopt
    if (typeof loader.setMeshoptDecoder === 'function') {
      const meshopt = (typeof window !== 'undefined' && (window.MeshoptDecoder || window.meshopt_decoder)) || null;
      if (meshopt) {
        try { if (meshopt.ready && typeof meshopt.ready.then === 'function') await meshopt.ready; } catch (_) {}
        loader.setMeshoptDecoder(meshopt);
      }
    }

    // Last-resort: stub KHR_texture_basisu to avoid hard failure if KTX2 still not attached
    if (!loader.ktx2Loader && typeof loader.register === 'function') {
      loader.register(() => ({
        name: 'KHR_texture_basisu',
        loadTexture: async () => {
          const tex = new THREE.Texture();
          tex.needsUpdate = true;
          return tex;
        }
      }));
    }

    loader.load(
      modelPath,
      (gltf) => {
        console.log('[3D] GLTF loaded successfully:', gltf);
        // Cache the loaded model
        modelCache.set(modelPath, {
          object: gltf.scene.clone(),
          scene: scene,
          camera: camera,
          renderer: renderer
        });
        finalizeWithObject(container, gltf.scene, scene, camera, renderer);
      },
      (progress) => {
        console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
      },
      (error) => {
        console.error('Error loading GLTF model:', error);
        container.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Failed to load GLB/GLTF. Check KTX2/Draco decoders and paths.</p>';
      }
    );
  };

  const loadObjOnly = async () => {
    const loader = await getObjLoader();
    if (!loader) {
      console.error('OBJLoader not available');
      container.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">OBJ loader unavailable.</p>';
      return;
    }
    loader.load(
      modelPath,
      (loadedObject) => {
        // Cache the loaded model
        modelCache.set(modelPath, {
          object: loadedObject.clone(),
          scene: scene,
          camera: camera,
          renderer: renderer
        });
        finalizeWithObject(container, loadedObject, scene, camera, renderer);
      },
      (progress) => {
        console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
      },
      (error) => {
        console.error('Error loading 3D model:', error);
        container.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Error loading 3D model. Please check the file path.</p>';
      }
    );
  };

  const tryLoadWithMtl = async () => {
    if (!/\.obj$/i.test(modelPath)) {
      loadObjOnly();
      return;
    }
    const mtlLoader = await getMtlLoader();
    if (!mtlLoader) {
      loadObjOnly();
      return;
    }
    const mtlPath = modelPath.replace(/\.obj$/i, '.mtl') + `?v=${Date.now()}`;
    const resourceBase = modelPath.substring(0, modelPath.lastIndexOf('/') + 1);
    try {
      const manager = (mtlLoader.manager) || THREE.DefaultLoadingManager;
      const previousModifier = manager._urlModifier || null;
      manager.setURLModifier((url) => {
        const base = resourceBase;
        const u = url.split('?')[0];
        const filename = u.split(/[/\\]/).pop();
        const rewritten = base + filename;
        const cacheBust = `v=${Date.now()}`;
        return rewritten + (rewritten.includes('?') ? `&${cacheBust}` : `?${cacheBust}`);
      });
      if (typeof mtlLoader.setPath === 'function') {
        mtlLoader.setPath(resourceBase);
      }
      mtlLoader.setResourcePath(resourceBase);
      if (typeof mtlLoader.setTexturePath === 'function') {
        mtlLoader.setTexturePath(resourceBase);
      }
      mtlLoader.load(
        mtlPath,
        async (materials) => {
          if (materials && materials.materialsInfo) {
            console.log('[3D] MTL materialsInfo:', JSON.parse(JSON.stringify(materials.materialsInfo)));
          }
          try { materials.preload(); } catch (_) {}
          const objL = await getObjLoader();
          if (objL && typeof objL.setMaterials === 'function') {
            objL.setMaterials(materials);
          }
          loadObjOnly();
        },
        undefined,
        () => {
          if (previousModifier) manager.setURLModifier(previousModifier);
          loadObjOnly();
        }
      );
    } catch (_) {
      loadObjOnly();
    }
  };
  
  // Determine loader based on file extension
  if (/\.(glb|gltf)$/i.test(modelPath)) {
    loadGLTF();
  } else if (/\.obj$/i.test(modelPath)) {
    tryLoadWithMtl();
  } else {
    console.error('Unsupported file format:', modelPath);
    container.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Unsupported file format. Please use .obj, .glb, or .gltf files.</p>';
  }
}

// Preload function to cache 3D models
export function preload3DModel(modelPath) {
  if (modelCache.has(modelPath)) {
    console.log('[3D] Model already cached:', modelPath);
    return Promise.resolve();
  }
  
  return new Promise(async (resolve, reject) => {
    // Create a temporary container for preloading
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '-9999px';
    document.body.appendChild(tempContainer);
    
    // Use the same loading logic but don't attach to visible container
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(1, 1);
    const gltfLoader = await getSharedGLTFLoader(renderer);
    
    const objLoader = await (async () => {
      let ctor = (typeof THREE !== 'undefined' && THREE.OBJLoader) || (typeof window !== 'undefined' && window.OBJLoader) || null;
      if (!ctor) {
        await ensureScriptLoaded('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/loaders/OBJLoader.js');
        ctor = (typeof THREE !== 'undefined' && THREE.OBJLoader) || (typeof window !== 'undefined' && window.OBJLoader) || null;
      }
      return ctor ? new ctor() : null;
    })();
    
    if (!objLoader && /\.obj$/i.test(modelPath)) {
      return onError(new Error('OBJLoader unavailable'));
    }
    
    const onLoad = (loadedObject) => {
      // Cache the loaded model
      modelCache.set(modelPath, {
        object: loadedObject.clone(),
        scene: scene,
        camera: camera,
        renderer: renderer
      });
      document.body.removeChild(tempContainer);
      console.log('[3D] Model preloaded:', modelPath);
      resolve();
    };
    
    const onError = async (error) => {
      document.body.removeChild(tempContainer);
      console.error('[3D] Preload error:', error);
      reject(error);
    };
    
    if (/\.(glb|gltf)$/i.test(modelPath)) {
      // Simple HTTP prefetch only, to avoid loader extension races in preload
      try {
        await fetch(modelPath, { cache: 'reload' });
        document.body.removeChild(tempContainer);
        console.log('[3D] GLB prefetched (HTTP only, no GLTF parsing):', modelPath);
        resolve();
      } catch (e) {
        onError(e);
      }
    } else if (/\.obj$/i.test(modelPath)) {
      objLoader.load(modelPath, onLoad, undefined, onError);
    } else {
      onError(new Error('Unsupported file format'));
    }
  });
} 