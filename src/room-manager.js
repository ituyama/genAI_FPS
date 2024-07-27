import { db } from './firebase-config.js';
import { doc, setDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { showNotification, log } from './ui-manager.js';
import { startListeningToRoomUpdates } from './player-manager.js';
import { generateId } from './utils.js';

let currentRoomId;
let playerId;

export async function createRoom() {
    const roomId = generateId();
    playerId = generateId();
    try {
        await setDoc(doc(db, 'rooms', roomId), {
            host: playerId,
            players: [playerId],
            playerPositions: {},
            shoots: {},
            created: new Date().toISOString()
        });
        currentRoomId = roomId;
        document.getElementById('roomId').textContent = `Room ID: ${roomId}`;
        showNotification('Room created. Waiting for players to join...');
        log(`Room created with ID: ${roomId}`);
        watchRoom(roomId);
    } catch (error) {
        console.error("Error creating room: ", error);
        showNotification('Failed to create room. Please try again.');
    }
}

export async function joinRoom(roomId) {
    playerId = generateId();
    try {
        const roomRef = doc(db, 'rooms', roomId);
        await updateDoc(roomRef, {
            players: arrayUnion(playerId)
        });
        currentRoomId = roomId;
        showNotification('Joined room successfully!');
        log(`Joined room with ID: ${roomId}`);
        watchRoom(roomId);
    } catch (error) {
        console.error("Error joining room: ", error);
        showNotification('Failed to join room. Please check the Room ID and try again.');
    }
}

function watchRoom(roomId) {
    startListeningToRoomUpdates(roomId);
}

export async function leaveRoom() {
    if (currentRoomId) {
        try {
            const roomRef = doc(db, 'rooms', currentRoomId);
            await updateDoc(roomRef, {
                players: arrayRemove(playerId),
                [`playerPositions.${playerId}`]: null,
                [`shoots.${playerId}`]: null
            });
            currentRoomId = null;
            showNotification('Left the room');
        } catch (error) {
            console.error("Error leaving room: ", error);
        }
    }
}

export function getCurrentRoomId() {
    return currentRoomId;
}

export function getPlayerId() {
    return playerId;
}