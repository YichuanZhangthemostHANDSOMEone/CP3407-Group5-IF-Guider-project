// src/modules/segmentation.ts


export interface Prediction {
  mask:    string;      // data:image/png;base64,...
  polygon?: number[];   // optional
  x:       number;
  y:       number;
  width:   number;
  height:  number;
  points: Array<{ x: number; y: number }>;
}

export class LegoSegmenter {
  async segment(canvas: HTMLCanvasElement): Promise<Prediction[] | null> {
    // 1) Canvas → JPEG Base64，去掉前缀
    const dataURL     = canvas.toDataURL('image/jpeg', 0.8);
    const imageBase64 = dataURL.split(',')[1];

    // 2) 调用后端 API
    const resp = await fetch('/api/segment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 })
    });

    if (!resp.ok) {
      console.error(`Segment service error: ${resp.status} ${resp.statusText}`);
      return null;
    }

    // 3) 解析返回
    const json  = await resp.json();
    const preds = (json.predictions || []) as Prediction[];
    return preds.length ? preds : null;
  }
}
