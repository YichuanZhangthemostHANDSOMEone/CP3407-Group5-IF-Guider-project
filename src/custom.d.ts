declare module '@mediapipe/segmentation';
declare module '@mediapipe/tasks-vision';
declare module 'firebase/app';
declare module 'firebase/auth';
declare module 'firebase/firestore';
declare module 'firebase/analytics';
declare module 'quantize' {
  const quantize: any;
  export default quantize;
}
declare module 'color.js';
declare module 'colorjs.io';
declare module 'colorjs.io/src/deltaE.js';
declare module '@techstark/opencv-js' {
  const cv: any;
  export default cv;
}
declare namespace cv {
  // 以后在签名里写 cv.Mat，TS 就认这是 any
  type Mat       = any;
  type MatVector = any;
}


declare const process: {
  env: { [key: string]: string };
};