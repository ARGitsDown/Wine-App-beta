// Browser-only image helpers shared by any client component that lets the
// user pick a photo before sending it to an AI or upload endpoint (the scan
// flow, the bottle detail page's "Add a photo"). Both callers need the same
// two steps first: shrink a phone photo down to a sane size, then read it
// as base64 for the request body.

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Phone photos can be several MB at very high resolution - more than
// needed and more than is worth paying to send. Shrinking to a modest max
// dimension keeps requests fast and cheap without hurting readability.
export function downscaleImage(file, maxDimension = 1568) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not process that image"))),
        "image/jpeg",
        0.85
      );
    };
    image.onerror = () => reject(new Error("Could not load that image"));
    image.src = objectUrl;
  });
}
