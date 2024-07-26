import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.167.0/three.module.js';

let scene, camera, renderer, player, raycaster, gun;
let targets = [];
let buildings = [];
let clouds = [];
let floors = [];
let laser;
let score = 0;
let isRunning = false;
let isJumping = false;
let jumpVelocity = 0;

const CHUNK_SIZE = 100;
const VIEW_DISTANCE = 300;
const GRAVITY = -9.8;
const JUMP_FORCE = 5;
const simplex = new SimplexNoise();

let peer;
let conn;
let isHost = false;
let peerAvatar;

function createPixelTexture(width, height, drawFunction) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    const imageData = context.createImageData(width, height);
    drawFunction(imageData.data);
    context.putImageData(imageData, 0, 0);
    return new THREE.CanvasTexture(canvas);
}

function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xADD8E6, 0, VIEW_DISTANCE);
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, VIEW_DISTANCE);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    raycaster = new THREE.Raycaster();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Sky
    scene.background = new THREE.Color(0x87CEEB);

    // Create clouds
    createClouds();

    // Player and camera
    player = new THREE.Object3D();
    player.add(camera);
    scene.add(player);
    player.position.set(0, 1.7, 0);

    // Gun
    const gunGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.3);
    const gunMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    gun = new THREE.Mesh(gunGeometry, gunMaterial);
    gun.position.set(0.2, -0.2, -0.5);
    camera.add(gun);

    // Laser
    const laserGeometry = new THREE.BufferGeometry();
    const laserMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
    laser = new THREE.Line(laserGeometry, laserMaterial);
    scene.add(laser);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('click', onShoot);

    generateCity();
    initP2P();
       log('Game initialized');
}

function createClouds() {
    const cloudGeometry = new THREE.SphereGeometry(5, 32, 32);
    const cloudMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });

    for (let i = 0; i < 20; i++) {
        const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
        cloud.position.set(
            Math.random() * 500 - 250,
            Math.random() * 50 + 50,
            Math.random() * 500 - 250
        );
        cloud.scale.set(Math.random() + 0.5, Math.random() + 0.5, Math.random() + 0.5);
        clouds.push(cloud);
        scene.add(cloud);
    }
}
function log(message) {
    console.log(message);
    const logContainer = document.getElementById('logContainer');
    const logEntry = document.createElement('div');
    logEntry.textContent = message;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function generateCity() {
    generateCityChunk(0, 0);
}

function createBuilding(x, z, width, depth, height) {
    const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
    const buildingMaterial = new THREE.MeshPhongMaterial({ color: 0xcccccc });
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.position.set(x, height/2, z);
    scene.add(building);
    buildings.push(building);

    addWindowsAndDoors(building);
}

function addWindowsAndDoors(building) {
    const windowGeometry = new THREE.PlaneGeometry(1, 1.5);
    const windowMaterial = new THREE.MeshPhongMaterial({ color: 0x87CEFA, transparent: true, opacity: 0.7 });
    const doorGeometry = new THREE.PlaneGeometry(2, 3);
    const doorMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });

    const buildingWidth = building.geometry.parameters.width;
    const buildingHeight = building.geometry.parameters.height;
    const buildingDepth = building.geometry.parameters.depth;

    // Add windows
    for (let i = 0; i < 4; i++) {
        for (let j = 1; j < Math.floor(buildingHeight / 3); j++) {
            for (let k = 0; k < (i % 2 === 0 ? buildingWidth : buildingDepth) / 3; k++) {
                const window = new THREE.Mesh(windowGeometry, windowMaterial);
                window.position.y = j * 3 - buildingHeight / 2;
                if (i === 0) {
                    window.position.x = k * 3 - buildingWidth / 2 + 1.5;
                    window.position.z = buildingDepth / 2 + 0.1;
                } else if (i === 1) {
                    window.position.x = buildingWidth / 2 + 0.1;
                    window.position.z = k * 3 - buildingDepth / 2 + 1.5;
                    window.rotation.y = Math.PI / 2;
                } else if (i === 2) {
                    window.position.x = k * 3 - buildingWidth / 2 + 1.5;
                    window.position.z = -buildingDepth / 2 - 0.1;
                    window.rotation.y = Math.PI;
                } else {
                    window.position.x = -buildingWidth / 2 - 0.1;
                    window.position.z = k * 3 - buildingDepth / 2 + 1.5;
                    window.rotation.y = -Math.PI / 2;
                }
                building.add(window);
            }
        }
    }

    // Add door
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.y = -buildingHeight / 2 + 1.5;
    door.position.z = buildingDepth / 2 + 0.1;
    building.add(door);
}

function createTarget() {
    const targetGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    const targetMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    const target = new THREE.Mesh(targetGeometry, targetMaterial);
    target.position.set(
        Math.random() * CHUNK_SIZE - CHUNK_SIZE / 2,
        Math.random() * 10 + 5,
        Math.random() * CHUNK_SIZE - CHUNK_SIZE / 2
    );
    scene.add(target);
    targets.push(target);
}

function onKeyDown(event) {
    if (event.key === 'Shift') {
        isRunning = true;
    }
    if (event.code === 'Space' && !isJumping) {
        isJumping = true;
        jumpVelocity = JUMP_FORCE;
    }
    const moveDistance = isRunning ? 1.0 : 0.5;
    const newPosition = player.position.clone();

    switch (event.key) {
        case 'w':
            newPosition.add(new THREE.Vector3(0, 0, -moveDistance).applyQuaternion(player.quaternion));
            break;
        case 's':
            newPosition.add(new THREE.Vector3(0, 0, moveDistance).applyQuaternion(player.quaternion));
            break;
        case 'a':
            newPosition.add(new THREE.Vector3(-moveDistance, 0, 0).applyQuaternion(player.quaternion));
            break;
        case 'd':
            newPosition.add(new THREE.Vector3(moveDistance, 0, 0).applyQuaternion(player.quaternion));
            break;
    }

    if (!checkCollision(newPosition)) {
        player.position.copy(newPosition);
    }
}

function onKeyUp(event) {
    if (event.key === 'Shift') {
        isRunning = false;
    }
}

function checkCollision(position) {
    for (const building of buildings) {
        const box = new THREE.Box3().setFromObject(building);
        if (box.containsPoint(position)) {
            return true;
        }
    }
    return false;
}

function onMouseMove(event) {
    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
    player.rotation.y -= movementX * 0.002;
    camera.rotation.x -= movementY * 0.002;
    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
}

function onShoot() {
    const start = new THREE.Vector3();
    const end = new THREE.Vector3();
    camera.getWorldPosition(start);
    camera.getWorldDirection(end);
    end.multiplyScalar(1000).add(start);

    const points = [start, end];
    laser.geometry.setFromPoints(points);
    laser.visible = true;

    raycaster.setFromCamera(new THREE.Vector2(), camera);
    const intersects = raycaster.intersectObjects(targets);

    if (intersects.length > 0) {
        const hitTarget = intersects[0].object;
        hitEffect(hitTarget.position);
        scene.remove(hitTarget);
        targets = targets.filter(target => target !== hitTarget);
        score += 100;
        updateScore();
        console.log("Target hit! Remaining targets:", targets.length);

        // Respawn target after 10 seconds
        setTimeout(createTarget, 10000);
    }

    // Hide laser after 100ms
    setTimeout(() => {
        laser.visible = false;
    }, 100);

    // Gun recoil animation
    const recoilDistance = 0.05;
    gun.position.z += recoilDistance;
    setTimeout(() => {
        gun.position.z -= recoilDistance;
    }, 50);

    sendShootEvent(start, end);
}

function hitEffect(position) {
    const particleCount = 20;
    const particles = new THREE.Group();

    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );

        particle.position.copy(position);
        const speed = new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3
        );

        particles.add(particle);

        gsap.to(particle.position, {
            x: particle.position.x + speed.x,
            y: particle.position.y + speed.y,
            z: particle.position.z + speed.z,
            duration: 0.5,
            ease: "power2.out",
            onComplete: () => {
                particles.remove(particle);
            }
        });
    }

    scene.add(particles);
    setTimeout(() => {
        scene.remove(particles);
    }, 1000);
}

function updateScore() {
    document.getElementById('score').textContent = `Score: ${score}`;
}

function updateCoordinates() {
    const coordsElement = document.getElementById('coordinates');
    coordsElement.textContent = `Coordinates: X: ${player.position.x.toFixed(2)}, Y: ${player.position.y.toFixed(2)}, Z: ${player.position.z.toFixed(2)}`;
}

function showNotification(message) {
    const notificationElement = document.getElementById('notifications');
    notificationElement.textContent = message;
    notificationElement.style.display = 'block';
    setTimeout(() => {
        notificationElement.style.display = 'none';
    }, 3000);
}

function animate() {
    requestAnimationFrame(animate);

    // Handle jumping
    if (isJumping) {
        player.position.y += jumpVelocity * 0.016; // Assuming 60 FPS
        jumpVelocity += GRAVITY * 0.016;
        if (player.position.y <= 1.7) {
            player.position.y = 1.7;
            isJumping = false;
            jumpVelocity = 0;
        }
    }

    // Move clouds
    clouds.forEach(cloud => {
        cloud.position.x += 0.05;
        if (cloud.position.x > CHUNK_SIZE/2) {
            cloud.position.x = -CHUNK_SIZE/2;
        }
    });

    // Check if we need to generate new city chunks
    const playerChunkX = Math.floor(player.position.x / CHUNK_SIZE);
    const playerChunkZ = Math.floor(player.position.z / CHUNK_SIZE);

    for (let x = playerChunkX - 1; x <= playerChunkX + 1; x++) {
        for (let z = playerChunkZ - 1; z <= playerChunkZ + 1; z++) {
            const chunkKey = `${x},${z}`;
            if (!generatedChunks.has(chunkKey)) {
                generateCityChunk(x * CHUNK_SIZE, z * CHUNK_SIZE);
                generatedChunks.add(chunkKey);
            }
        }
    }

    // Remove far away buildings and floors
    buildings = buildings.filter(building => {
        if (building.position.distanceTo(player.position) > VIEW_DISTANCE) {
scene.remove(building);
            return false;
        }
        return true;
    });

    floors = floors.filter(floor => {
        if (floor.position.distanceTo(player.position) > VIEW_DISTANCE) {
            scene.remove(floor);
            return false;
        }
        return true;
    });

    // Ensure there are always 5 targets
    while (targets.length < 5) {
        createTarget();
    }

    updateCoordinates();
    sendPositionUpdate();

    renderer.render(scene, camera);
}

const generatedChunks = new Set();

function generateCityChunk(chunkX, chunkZ) {
    const buildingTypes = [
        { width: 8, depth: 8, minHeight: 15, maxHeight: 40 },
        { width: 12, depth: 12, minHeight: 25, maxHeight: 60 },
        { width: 16, depth: 16, minHeight: 35, maxHeight: 80 },
    ];

    // Generate floor
    const floorGeometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE);
    const floorTexture = createPixelTexture(64, 64, (data) => {
        for (let i = 0; i < data.length; i += 4) {
            const color = Math.random() > 0.5 ? 100 : 120;
            data[i] = color;
            data[i+1] = color;
            data[i+2] = color;
            data[i+3] = 255;
        }
    });
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(10, 10);
    const floorMaterial = new THREE.MeshPhongMaterial({ map: floorTexture });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(chunkX + CHUNK_SIZE / 2, 0, chunkZ + CHUNK_SIZE / 2);
    scene.add(floor);
    floors.push(floor);

    // Increase city density by reducing the step size and lowering the noise threshold
    for (let x = chunkX; x < chunkX + CHUNK_SIZE; x += 20) {
        for (let z = chunkZ; z < chunkZ + CHUNK_SIZE; z += 20) {
            if (simplex.noise2D(x * 0.01, z * 0.01) > 0.3) {
                const type = buildingTypes[Math.floor(Math.random() * buildingTypes.length)];
                const height = Math.random() * (type.maxHeight - type.minHeight) + type.minHeight;
                createBuilding(x, z, type.width, type.depth, height);
            }
        }
    }

    log(`Generated city chunk at (${chunkX}, ${chunkZ})`);
}

// P2P Communication

function initP2P() {
    peer = new Peer();
    
    peer.on('open', (id) => {
        log(`My peer ID is: ${id}`);
    });

    peer.on('error', (error) => {
        log(`Peer error: ${error.type}`);
    });

    document.getElementById('createBtn').addEventListener('click', createRoom);
    document.getElementById('joinBtn').addEventListener('click', joinRoom);

    peer.on('connection', (connection) => {
        conn = connection;
        setupConnection();
        showNotification('A player has joined the room!');
        log('Incoming connection established');
    });
}


function createRoom() {
    isHost = true;
    const roomId = Math.random().toString(36).substr(2, 9);
    document.getElementById('roomId').textContent = `Room ID: ${roomId}`;
    showNotification('Room created. Waiting for players to join...');
    log(`Room created with ID: ${roomId}`);
}

function joinRoom() {
    const roomId = document.getElementById('joinInput').value;
    conn = peer.connect(roomId);
    setupConnection();
    showNotification('Joining room...');
    log(`Attempting to join room with ID: ${roomId}`);
}


function setupConnection() {
    conn.on('open', () => {
        log('Connected to peer');
        showNotification('Connected to peer!');
        conn.on('data', (data) => {
            handlePeerData(data);
        });
    });

    conn.on('close', () => {
        log('Connection closed');
    });

    conn.on('error', (error) => {
        log(`Connection error: ${error}`);
    });
}

function handlePeerData(data) {
    log(`Received data: ${JSON.stringify(data)}`);
    if (data.type === 'position') {
        updatePeerPosition(data.position);
    } else if (data.type === 'shoot') {
        createPeerLaser(data.start, data.end);
    }
}
function updatePeerPosition(position) {
    if (!peerAvatar) {
        const avatarGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        const avatarMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        peerAvatar = new THREE.Mesh(avatarGeometry, avatarMaterial);
        scene.add(peerAvatar);
        log('Peer avatar created');
    }
    peerAvatar.position.set(position.x, position.y, position.z);
    log(`Peer position updated: ${JSON.stringify(position)}`);
}

function createPeerLaser(start, end) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(start.x, start.y, start.z),
        new THREE.Vector3(end.x, end.y, end.z)
    ]);
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    const laserLine = new THREE.Line(geometry, material);
    scene.add(laserLine);
    setTimeout(() => scene.remove(laserLine), 100);
}

function sendPositionUpdate() {
    if (conn && conn.open) {
        const position = {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z
        };
        conn.send({
            type: 'position',
            position: position
        });
        log(`Sent position update: ${JSON.stringify(position)}`);
    }
}

function sendShootEvent(start, end) {
    if (conn && conn.open) {
        const data = {
            type: 'shoot',
            start: {
                x: start.x,
                y: start.y,
                z: start.z
            },
            end: {
                x: end.x,
                y: end.y,
                z: end.z
            }
        };
        conn.send(data);
        log(`Sent shoot event: ${JSON.stringify(data)}`);
    }
}
init();
animate();

renderer.domElement.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
});