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
    // context.clearRect(0, 0, canvas.width, canvas.height);

    // Fill the canvas with white
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Render the emoji in the center
    context.font = `${Math.floor(0.75 * size)}px serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(emoji, size / 2, size / 2);

    // // Find the average color on nontransparent pixels
    // const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    // let totalR = 0;
    // let totalG = 0;
    // let totalB = 0;
    // let totalPixels = 0;
    // for (let i = 0; i < imageData.data.length; i += 4) {
    //   if (imageData.data[i + 3] > 0) {
    //     totalR += imageData.data[i];
    //     totalG += imageData.data[i + 1];
    //     totalB += imageData.data[i + 2];
    //     totalPixels++;
    //   }
    // }
    // const averageR = Math.floor(totalR / totalPixels);
    // const averageG = Math.floor(totalG / totalPixels);
    // const averageB = Math.floor(totalB / totalPixels);

    // // Fill the canvas with the average color
    // context.fillStyle = `rgb(${averageR}, ${averageG}, ${averageB})`;
    // context.fillRect(0, 0, canvas.width, canvas.height);

    // // Now render the emoji again
    // context.fillStyle = 'black';
    // context.fillText(emoji, size / 2, size / 2);

    const img = new Image();
    img.src = canvas.toDataURL();
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
};

export const createEmojiTiledImage = async (emojis: string[], tilesPerRow: number, tileSize: number): Promise<HTMLImageElement> => {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const rows = Math.ceil(emojis.length / tilesPerRow);
    const canvas = document.createElement('canvas');
    canvas.width = tilesPerRow * tileSize;
    canvas.height = rows * tileSize;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get canvas context');
    }

    // Clear the canvas to make it transparent
    // context.clearRect(0, 0, canvas.width, canvas.height);

    for (const [index, emoji] of emojis.entries()) {
      const img = await createEmojiImage(emoji, tileSize);
      const x = (index % tilesPerRow) * tileSize;
      const y = Math.floor(index / tilesPerRow) * tileSize;
      context.drawImage(img, x, y, tileSize, tileSize);
    }

    const img = new Image();
    img.src = canvas.toDataURL();
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
};

export const createEmojiTexture = async (gl: WebGL2RenderingContext, emojis: string[], tilesPerRow: number, tileSize: number): Promise<WebGLTexture> => {
  const img = await createEmojiTiledImage(emojis, tilesPerRow, tileSize);
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('Could not create texture');
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return texture;
}
