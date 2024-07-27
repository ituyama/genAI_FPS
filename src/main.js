import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { createRoom, joinRoom, leaveRoom } from './room-manager.js';
import { updatePlayerPosition, sendShootEvent } from './player-manager.js';
import { showNotification, updateScore, updateCoordinates, log } from './ui-manager.js';
import { createPixelTexture, generateId } from './utils.js';

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
let otherPlayers = new Map();

const CHUNK_SIZE = 100;
const VIEW_DISTANCE = 300;
const GRAVITY = -9.8;
const JUMP_FORCE = 5;
const simplex = new SimplexNoise();

function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xADD8E6, 0, VIEW_DISTANCE);
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, VIEW_DISTANCE);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    raycaster = new THREE.Raycaster();

    const ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    scene.background = new THREE.Color(0x87CEEB);

    createClouds();

    player = new THREE.Object3D();
    player.add(camera);
    scene.add(player);
    player.position.set(0, 1.7, 0);

    const gunGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.3);
    const gunMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    gun = new THREE.Mesh(gunGeometry, gunMaterial);
    gun.position.set(0.2, -0.2, -0.5);
    camera.add(gun);

    const laserGeometry = new THREE.BufferGeometry();
    const laserMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
    laser = new THREE.Line(laserGeometry, laserMaterial);
    scene.add(laser);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('click', onShoot);

    generateCity();

    document.getElementById('createBtn').addEventListener('click', createRoom);
    document.getElementById('joinBtn').addEventListener('click', () => {
        const roomId = document.getElementById('joinInput').value;
        joinRoom(roomId);
    });
    window.addEventListener('beforeunload', leaveRoom);

    log('Game initialized');
    toggleControllerVisibility();
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
        updateScore(score);
        log("Target hit! Remaining targets: " + targets.length);

        setTimeout(createTarget, 10000);
    }

    setTimeout(() => {
        laser.visible = false;
    }, 100);

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

function animate() {
    requestAnimationFrame(animate);

    if (isJumping) {
        player.position.y += jumpVelocity * 0.016;
        jumpVelocity += GRAVITY * 0.016;
        if (player.position.y <= 1.7) {
            player.position.y = 1.7;
            isJumping = false;
            jumpVelocity = 0;
        }
    }

    clouds.forEach(cloud => {
        cloud.position.x += 0.05;
        if (cloud.position.x > CHUNK_SIZE/2) {
            cloud.position.x = -CHUNK_SIZE/2;
        }
    });

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

    while (targets.length < 5) {
        createTarget();
    }

    updateCoordinates(player.position.x, player.position.y, player.position.z);
    updatePlayerPosition({
        x: player.position.x,
        y: player.position.y,
        z: player.position.z
    });

    renderer.render(scene, camera);
}

const generatedChunks = new Set();

function generateCityChunk(chunkX, chunkZ) {
    const buildingTypes = [
        { width: 8, depth: 8, minHeight: 15, maxHeight: 40 },
        { width: 12, depth: 12, minHeight: 25, maxHeight: 60 },
        { width: 16, depth: 16, minHeight: 35, maxHeight: 80 },
    ];

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
function toggleControllerVisibility() {
    const controller = document.getElementById('controller');
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        controller.style.display = 'flex';
    } else {
        controller.style.display = 'none';
    }
}
function createPlayerModel() {
    const geometry = new THREE.BoxGeometry(1, 2, 1);
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    return new THREE.Mesh(geometry, material);
}

export function updatePeerPosition(id, position) {
    let playerModel = otherPlayers.get(id);
    if (!playerModel) {
        playerModel = createPlayerModel();
        scene.add(playerModel);
        otherPlayers.set(id, playerModel);
    }
    playerModel.position.set(position.x, position.y, position.z);
}

export function removePeerFromScene(id) {
    const playerModel = otherPlayers.get(id);
    if (playerModel) {
        scene.remove(playerModel);
        otherPlayers.delete(id);
    }
}

export function createPeerLaser(start, end) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(start.x, start.y, start.z),
        new THREE.Vector3(end.x, end.y, end.z)
    ]);
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    const laserLine = new THREE.Line(geometry, material);
    scene.add(laserLine);
    setTimeout(() => scene.remove(laserLine), 100);
}

window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
animate();

renderer.domElement.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
});

document.addEventListener('pointerlockchange', onPointerLockChange, false);

function onPointerLockChange() {
    if (document.pointerLockElement === renderer.domElement) {
        document.addEventListener('mousemove', onMouseMove, false);
    } else {
        document.removeEventListener('mousemove', onMouseMove, false);
    }
}
document.addEventListener('keydown', (event) => {
    if (event.key === 'c' || event.key === 'C') {
        const controller = document.getElementById('controller');
        controller.style.display = controller.style.display === 'none' ? 'flex' : 'none';
    }
});