/**
 * Image utility functions for handling orientation and EXIF data
 * Enhanced for iPhone/iOS compatibility
 */

/**
 * Debug function to log image details
 */
function logImageDetails(file: File, orientation: number) {
  console.log('Image Details:', {
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: new Date(file.lastModified),
    orientation: orientation
  });
}

/**
 * Get the EXIF orientation value from an image file
 * Enhanced with better error handling and debugging
 */
function getOrientation(file: File): Promise<number> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const view = new DataView(e.target?.result as ArrayBuffer);
        
        // Check if it's a JPEG (starts with 0xFFD8)
        if (view.getUint16(0, false) !== 0xFFD8) {
          console.log('Not a JPEG file, assuming normal orientation');
          resolve(1);
          return;
        }

        const length = view.byteLength;
        let offset = 2;

        while (offset < length) {
          const marker = view.getUint16(offset, false);
          offset += 2;

          // Look for APP1 marker (0xFFE1) which contains EXIF data
          if (marker === 0xFFE1) {
            // Skip length
            offset += 2;
            
            // Check for EXIF header
            if (view.getUint32(offset, false) !== 0x45786966) {
              console.log('No EXIF header found');
              resolve(1);
              return;
            }
            
            offset += 4;
            
            // Skip null terminator
            if (view.getUint16(offset, false) !== 0x0000) {
              console.log('Invalid EXIF format');
              resolve(1);
              return;
            }
            offset += 2;

            // Check byte order (little or big endian)
            const little = view.getUint16(offset, false) === 0x4949;
            offset += view.getUint32(offset + 4, little);
            const tags = view.getUint16(offset, little);
            offset += 2;

            // Look through tags for orientation (0x0112)
            for (let i = 0; i < tags; i++) {
              const tagOffset = offset + (i * 12);
              if (tagOffset + 12 > length) break;
              
              if (view.getUint16(tagOffset, little) === 0x0112) {
                const orientation = view.getUint16(tagOffset + 8, little);
                console.log(`Found EXIF orientation: ${orientation}`);
                resolve(orientation);
                return;
              }
            }
          } else if ((marker & 0xFF00) !== 0xFF00) {
            break;
          } else {
            // Skip this segment
            const segmentLength = view.getUint16(offset, false);
            offset += segmentLength;
          }
        }
        
        console.log('No orientation data found in EXIF, assuming normal');
        resolve(1);
      } catch (error) {
        console.error('Error reading EXIF data:', error);
        resolve(1);
      }
    };

    reader.onerror = function() {
      console.error('Error reading file for EXIF data');
      resolve(1);
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Detect if an image needs rotation based on dimensions and device
 * Fallback method for when EXIF data is unreliable
 */
function detectImageRotationNeeded(img: HTMLImageElement, file: File): boolean {
  // Check if it's likely a mobile photo that needs rotation
  const isFromMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  const aspectRatio = img.naturalWidth / img.naturalHeight;
  
  // If it's from mobile and appears to be landscape but file suggests portrait
  if (isFromMobile && aspectRatio > 1 && file.name.toLowerCase().includes('img_')) {
    console.log('Detected potential mobile photo needing rotation');
    return true;
  }
  
  return false;
}

/**
 * Determine if the file is an HEIC/HEIF image
 */
function isHeicLike(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type.includes('heic') || type.includes('heif')) {
    return true;
  }

  const name = file.name.toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif');
}

/**
 * Process an image file to correct orientation based on EXIF data
 * Enhanced with better iPhone/iOS support
 */
export async function processImageOrientation(file: File): Promise<File> {
  const isJPEG = /jpe?g$/i.test(file.type) || file.type === 'image/jpg';
  const orientation = isJPEG ? await getOrientation(file) : 1;
  const forceCanvasProcessing = isHeicLike(file);
  logImageDetails(file, orientation);
  
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = function() {
      try {
        const { naturalWidth: width, naturalHeight: height } = img;
        console.log(`Original image dimensions: ${width}x${height}`);
        
        // Check if we need rotation based on EXIF or heuristics
        const needsRotationByEXIF = orientation !== 1;
        const needsRotationByHeuristics = detectImageRotationNeeded(img, file);
        
        if (!needsRotationByEXIF && !needsRotationByHeuristics && !forceCanvasProcessing) {
          console.log('No rotation needed');
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }

        if (!ctx) {
          console.error('Canvas context not available');
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }

        // Set canvas dimensions based on orientation
        if (orientation >= 5 && orientation <= 8) {
          // 90 or 270 degree rotations swap dimensions
          canvas.width = height;
          canvas.height = width;
        } else {
          canvas.width = width;
          canvas.height = height;
        }

        console.log(`Canvas dimensions: ${canvas.width}x${canvas.height}`);
        
        // Apply transformations based on EXIF orientation
        switch (orientation) {
          case 2:
            // Horizontal flip
            ctx.transform(-1, 0, 0, 1, width, 0);
            break;
          case 3:
            // 180° rotation
            ctx.transform(-1, 0, 0, -1, width, height);
            break;
          case 4:
            // Vertical flip
            ctx.transform(1, 0, 0, -1, 0, height);
            break;
          case 5:
            // 90° rotation + horizontal flip
            ctx.transform(0, 1, 1, 0, 0, 0);
            break;
          case 6:
            // 90° clockwise rotation
            ctx.transform(0, 1, -1, 0, height, 0);
            break;
          case 7:
            // 270° rotation + horizontal flip
            ctx.transform(0, -1, -1, 0, height, width);
            break;
          case 8:
            // 270° clockwise rotation
            ctx.transform(0, -1, 1, 0, 0, width);
            break;
          default:
            // If heuristics suggested rotation but no EXIF, try 90° rotation
            if (needsRotationByHeuristics) {
              console.log('Applying heuristic-based 90° rotation');
              canvas.width = height;
              canvas.height = width;
              ctx.transform(0, 1, -1, 0, height, 0);
            }
            break;
        }
        
        // Draw the image
        ctx.drawImage(img, 0, 0, width, height);
        
        const determineTargetMime = () => {
          if (forceCanvasProcessing) {
            return 'image/jpeg';
          }
          return file.type || 'image/jpeg';
        };

        const convertCanvasToBlob = (mimeType: string) =>
          new Promise<Blob | null>((blobResolve) => {
            const quality = mimeType === 'image/png' ? undefined : 0.92;
            canvas.toBlob((blob) => blobResolve(blob), mimeType, quality);
          });

        const finalize = async () => {
          let targetMime = determineTargetMime();
          let blob = await convertCanvasToBlob(targetMime);

          if (!blob && targetMime !== 'image/png') {
            console.warn(`Failed to encode ${targetMime}, falling back to image/png`);
            targetMime = 'image/png';
            blob = await convertCanvasToBlob(targetMime);
          }

          if (!blob) {
            console.error('Failed to convert canvas to blob');
            URL.revokeObjectURL(objectUrl);
            resolve(file);
            return;
          }

          const targetName = (() => {
            if (!forceCanvasProcessing) {
              return file.name;
            }
            if (file.name.toLowerCase().match(/\.(heic|heif)$/)) {
              return file.name.replace(/\.(heic|heif)$/i, targetMime === 'image/png' ? '.png' : '.jpg');
            }
            return file.name;
          })();

          const processedFile = new File([blob], targetName, {
            type: targetMime,
            lastModified: file.lastModified,
          });
          console.log('Successfully processed image orientation');
          URL.revokeObjectURL(objectUrl);
          resolve(processedFile);
        };

        finalize().catch((error) => {
          console.error('Error converting canvas to blob:', error);
          URL.revokeObjectURL(objectUrl);
          resolve(file);
        });
      } catch (error) {
        console.error('Error processing image:', error);
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      }
    };
    
    img.onerror = function() {
      console.error('Error loading image for processing');
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    
    // Important: Set crossOrigin before src for security
    img.crossOrigin = 'anonymous';
    img.src = objectUrl;
  });
}

/**
 * Process multiple image files for orientation correction
 */
export async function processMultipleImages(files: File[]): Promise<File[]> {
  console.log(`Processing ${files.length} images for orientation`);
  const processedFiles = await Promise.all(
    files.map(file => processImageOrientation(file))
  );
  return processedFiles;
}
