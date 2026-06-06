// Real face-api.js verification path. Only imported when FALLBACK_MODE !== "true".
// Requires:  pnpm add @vladmandic/face-api @tensorflow/tfjs-node canvas
// and models downloaded to ./models (see scripts/download-models.ts).
//
// This file is intentionally kept lazy and dependency-free at the type level so
// the fallback build still works without the heavy deps installed.

export type VerifyArgs = {
  photoBlobId: string;
  members: { addr: string; display_name?: string; reference_blob_id: string }[];
  walrusAggregator: string;
};

export type VerifyResult = {
  passed: boolean;
  reason: string;
  matched_members: string[];
};

const SIMILARITY_THRESHOLD = 0.6; // euclidean distance — lower is more similar

export async function verifyFaces(args: VerifyArgs): Promise<VerifyResult> {
  // Lazy import the heavy deps.
  const faceapi: any = await import("@vladmandic/face-api");
  const tf: any = await import("@tensorflow/tfjs-node");
  const { createCanvas, Image, ImageData } = await import("canvas") as any;

  faceapi.env.monkeyPatch({ Canvas: createCanvas as any, Image, ImageData });

  await loadModels(faceapi);

  const photo = await fetchAsBuffer(`${args.walrusAggregator}/v1/blobs/${args.photoBlobId}`);
  const photoCanvas = await bufferToCanvas(photo, createCanvas, Image);
  const photoDetections = await faceapi
    .detectAllFaces(photoCanvas)
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (!photoDetections.length) {
    return { passed: false, reason: "no_face_found", matched_members: [] };
  }

  // Build labeled descriptors for each member
  const labeled: any[] = [];
  for (const m of args.members) {
    const buf = await fetchAsBuffer(`${args.walrusAggregator}/v1/blobs/${m.reference_blob_id}`);
    const canvas = await bufferToCanvas(buf, createCanvas, Image);
    const ref = await faceapi
      .detectSingleFace(canvas)
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (ref?.descriptor) {
      labeled.push(
        new faceapi.LabeledFaceDescriptors(m.display_name || m.addr, [ref.descriptor]),
      );
    }
  }

  if (!labeled.length) {
    return { passed: false, reason: "no_reference_faces", matched_members: [] };
  }

  const matcher = new faceapi.FaceMatcher(labeled, SIMILARITY_THRESHOLD);
  const matched: string[] = [];
  for (const det of photoDetections) {
    const best = matcher.findBestMatch(det.descriptor);
    if (best.label === "unknown") {
      return { passed: false, reason: "unknown_face_detected", matched_members: matched };
    }
    matched.push(best.label);
  }

  return {
    passed: true,
    reason: "all_faces_matched_group_members",
    matched_members: matched,
  };
}

async function loadModels(faceapi: any) {
  const modelPath = process.env.FACE_MODELS_PATH || "./models";
  if (!faceapi.nets.tinyFaceDetector.isLoaded) {
    await faceapi.nets.tinyFaceDetector.loadFromDisk(modelPath);
  }
  if (!faceapi.nets.faceLandmark68Net.isLoaded) {
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
  }
  if (!faceapi.nets.faceRecognitionNet.isLoaded) {
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
  }
}

async function fetchAsBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function bufferToCanvas(buf: Buffer, createCanvas: any, Image: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = createCanvas(img.width, img.height);
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = reject;
    img.src = buf;
  });
}
