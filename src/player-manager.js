import { db } from './firebase-config.js';
import { doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { log } from './ui-manager.js';
import { getCurrentRoomId, getPlayerId } from './room-manager.js';
import { updatePeerPosition, removePeerFromScene, createPeerLaser } from './main.js';

let currentPlayers = new Set();

export function updatePlayersInRoom(players) {
    log(`Players in room: ${players.join(', ')}`);
    
    // Add new players
    players.forEach(playerId => {
        if (!currentPlayers.has(playerId) && playerId !== getPlayerId()) {
            currentPlayers.add(playerId);
        }
    });

    // Remove players who left
    currentPlayers.forEach(playerId => {
        if (!players.includes(playerId)) {
            currentPlayers.delete(playerId);
            removePeerFromScene(playerId);
        }
    });
}

export function updatePlayerPositions(positions) {
    for (const [id, position] of Object.entries(positions)) {
        if (id !== getPlayerId()) {
            updatePeerPosition(id, position);
        }
    }
}

export async function updatePlayerPosition(position) {
    const currentRoomId = getCurrentRoomId();
    if (currentRoomId) {
        try {
            const roomRef = doc(db, 'rooms', currentRoomId);
            await updateDoc(roomRef, {
                [`playerPositions.${getPlayerId()}`]: position
            });
        } catch (error) {
            console.error("Error updating position: ", error);
        }
    }
}

export function handleShoots(shoots) {
    for (const [id, shoot] of Object.entries(shoots)) {
        if (id !== getPlayerId()) {
            createPeerLaser(shoot.start, shoot.end);
        }
    }
}

export async function sendShootEvent(start, end) {
    const currentRoomId = getCurrentRoomId();
    if (currentRoomId) {
        try {
            const roomRef = doc(db, 'rooms', currentRoomId);
            await updateDoc(roomRef, {
                [`shoots.${getPlayerId()}`]: {
                    start: { x: start.x, y: start.y, z: start.z },
                    end: { x: end.x, y: end.y, z: end.z },
                    timestamp: Date.now()
                }
            });
        } catch (error) {
            console.error("Error sending shoot event: ", error);
        }
    }
}

export function startListeningToRoomUpdates(roomId) {
    const roomRef = doc(db, 'rooms', roomId);
    return onSnapshot(roomRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            updatePlayersInRoom(data.players);
            updatePlayerPositions(data.playerPositions);
            handleShoots(data.shoots);
        }
    });
}