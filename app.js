// --- Global Variables (Optimized for Mobile) ---
// Reduced particle count for better mobile framerates
const particleCount = 5000; 
let scene, camera, renderer, points;
let baseGeometry;
let handDistance = 0.5; // Normalized distance between hands (0.0 to 1.0)
const videoElement = document.getElementById('video');

// --- 1. THREE.js Setup ---

function initThree() {
    scene = new THREE.Scene();
    // Use a small far clipping plane for scale effect
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100); 
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({ 
        antialias: false, // Turn off for speed on mobile
        alpha: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Limit Pixel Ratio: Prevents rendering at super-high mobile DPI for performance
    const maxPixelRatio = 1.5; 
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));

    document.getElementById('three-container').appendChild(renderer.domElement);

    createPoints('heart'); // Initialize with heart template
    window.addEventListener('resize', onWindowResize);
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- 2. Particle Template Logic ---

function createPoints(templateName) {
    if (points) scene.remove(points);

    baseGeometry = new THREE.BufferGeometry();
    let positions = [];
    
    for (let i = 0; i < particleCount; i++) {
        let x, y, z;
        const radius = 2; 

        if (templateName === 'heart') {
            const t = Math.random() * 2 * Math.PI;
            const r = Math.pow(Math.random(), 0.5); 
            x = 16 * Math.sin(t)**3 * r * 0.15;
            y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * r * 0.04;
            z = (Math.random() - 0.5) * 0.2;
        } else if (templateName === 'sphere') {
            const phi = Math.random() * 2 * Math.PI;
            const theta = Math.acos(Math.random() * 2 - 1);
            x = radius * Math.sin(theta) * Math.cos(phi);
            y = radius * Math.sin(theta) * Math.sin(phi);
            z = radius * Math.cos(theta);
        } else if (templateName === 'saturn') {
            if (i < particleCount * 0.2) { // Central Body
                const phi = Math.random() * 2 * Math.PI;
                const theta = Math.acos(Math.random() * 2 - 1);
                const r = Math.random() * 0.8; 
                x = r * Math.sin(theta) * Math.cos(phi);
                y = r * Math.sin(theta) * Math.sin(phi);
                z = r * Math.cos(theta);
            } else { // Ring
                const r_min = 1.2;
                const r_max = 3.0;
                const angle = Math.random() * 2 * Math.PI;
                const r = r_min + Math.random() * (r_max - r_min);
                x = r * Math.cos(angle);
                y = r * Math.sin(angle);
                z = (Math.random() - 0.5) * 0.1; // Thin plane
            }
        } else if (templateName === 'fireworks') {
            x = (Math.random() - 0.5) * 10;
            y = (Math.random() - 0.5) * 10;
            z = (Math.random() - 0.5) * 10;
        }

        positions.push(x, y, z);
    }

    baseGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    let particleColor = new THREE.Color(document.getElementById('color-selector').value);
    
    const material = new THREE.PointsMaterial({
        color: particleColor,
        size: 0.05,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8,
    });

    points = new THREE.Points(baseGeometry, material);
    scene.add(points);
}

// --- 3. Computer Vision (MediaPipe) ---

const hands = new Hands({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
    maxNumHands: 2, 
    modelComplexity: 1,
    // Relaxed confidence for quicker, less resource-intensive tracking on mobile
    minDetectionConfidence: 0.3, 
    minTrackingConfidence: 0.3
});

hands.onResults(onResults);

const cameraMP = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
    },
    width: 640,
    height: 480
});
cameraMP.start();

function onResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length === 2) {
        const hand1 = results.multiHandLandmarks[0];
        const hand2 = results.multiHandLandmarks[1];

        // Use the wrist landmark (index 0)
        const wrist1 = hand1[0];
        const wrist2 = hand2[0];

        // Calculate 3D Euclidean distance
        const dx = wrist1.x - wrist2.x;
        const dy = wrist1.y - wrist2.y;
        const dz = wrist1.z - wrist2.z;
        
        const currentDistance = Math.sqrt(dx*dx + dy*dy + dz*dz); 
        
        // Smoothly update the distance
        handDistance = THREE.MathUtils.lerp(handDistance, currentDistance, 0.1); 

    } else {
        // Default to a neutral distance if hands are lost
        handDistance = THREE.MathUtils.lerp(handDistance, 0.5, 0.1);
    }
}

// --- 4. Animation and Real-Time Interaction ---

function animate() {
    requestAnimationFrame(animate);

    if (points) {
        // Mapping Logic: Clenching (low distance) = LOW scale, Opening (high distance) = HIGH scale
        
        // 1. Clamp the distance to expected operating range
        let normalizedDist = THREE.MathUtils.clamp(handDistance, 0.1, 0.8);
        
        // 2. Map normalized range [0.1, 0.8] to scale range [0.5, 3.0]
        let minScale = 0.5;
        let maxScale = 3.0;
        
        let scaleFactor = minScale + (maxScale - minScale) * ((normalizedDist - 0.1) / (0.8 - 0.1));

        // Apply Scaling (Requirement 1 & 4)
        points.scale.set(scaleFactor, scaleFactor, scaleFactor);
        
        // Simple rotation for visual interest
        points.rotation.y += 0.005; 
    }

    renderer.render(scene, camera);
}

// --- 5. UI Event Listeners ---

document.getElementById('template-selector').addEventListener('change', (event) => {
    createPoints(event.target.value);
});

document.getElementById('color-selector').addEventListener('input', (event) => {
    if (points && points.material) {
        points.material.color.set(event.target.value);
    }
});

// --- Start the Application ---
initThree();