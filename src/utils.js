export function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

export function createPixelTexture(width, height, drawFunction) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    const imageData = context.createImageData(width, height);
    drawFunction(imageData.data);
    context.putImageData(imageData, 0, 0);
    return new THREE.CanvasTexture(canvas);
}