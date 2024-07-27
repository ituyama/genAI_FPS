export function showNotification(message) {
    const notificationElement = document.getElementById('notifications');
    notificationElement.textContent = message;
    notificationElement.style.display = 'block';
    setTimeout(() => {
        notificationElement.style.display = 'none';
    }, 3000);
}

export function log(message) {
    console.log(message);
    const logContainer = document.getElementById('logContainer');
    const logEntry = document.createElement('div');
    logEntry.textContent = message;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

export function updateScore(score) {
    document.getElementById('score').textContent = `Score: ${score}`;
}

export function updateCoordinates(x, y, z) {
    const coordsElement = document.getElementById('coordinates');
    coordsElement.textContent = `Coordinates: X: ${x.toFixed(2)}, Y: ${y.toFixed(2)}, Z: ${z.toFixed(2)}`;
}