export const createEmojiImage = (emoji: string, size: number): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    if (!context) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    // Clear the canvas to make it transparent
    context.clearRect(0, 0, canvas.width, canvas.height);

    context.font = `${Math.floor(0.75 * size)}px serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(emoji, 16, 16);

    // Find the average color on nontransparent pixels
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let totalPixels = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i + 3] > 0) {
        totalR += imageData.data[i];
        totalG += imageData.data[i + 1];
        totalB += imageData.data[i + 2];
        totalPixels++;
      }
    }
    const averageR = Math.floor(totalR / totalPixels);
    const averageG = Math.floor(totalG / totalPixels);
    const averageB = Math.floor(totalB / totalPixels);

    // Fill the canvas with the average color
    context.fillStyle = `rgb(${averageR}, ${averageG}, ${averageB})`;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Now render the emoji again
    context.fillStyle = 'black';
    context.fillText(emoji, size / 2, size / 2);

    const img = new Image();
    img.src = canvas.toDataURL();
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
};

export const createEmojiTiledImage = async (emojis: string[], tilesPerRow: number, tileSize: number): Promise<HTMLImageElement> => {
  const rows = Math.ceil(emojis.length / tilesPerRow);
  const canvas = document.createElement('canvas');
  canvas.width = tilesPerRow * tileSize;
  canvas.height = rows * tileSize;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not get canvas context');
  }

  // Clear the canvas to make it transparent
  context.clearRect(0, 0, canvas.width, canvas.height);

  for (const [index, emoji] of emojis.entries()) {
    const img = await createEmojiImage(emoji, tileSize);
    const x = (index % tilesPerRow) * tileSize;
    const y = Math.floor(index / tilesPerRow) * tileSize;
    context.drawImage(img, x, y, tileSize, tileSize);
  }

  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
};

