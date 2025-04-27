// import { useEffect, useRef, useState } from 'react';
// import { IonApp, IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonText, IonPage } from '@ionic/react';
// import { useLocation, useHistory } from 'react-router-dom';

// const HOLD_TIME = 0; // ms for a valid occurrence

// interface LocationState {
//   range: { min: number; max: number };
//   occurrenceLimit: number;
// }

// const DetectOccurrences: React.FC = () => {
//   const location = useLocation<LocationState>();
//   const history = useHistory();

//   const { range, occurrenceLimit } = location.state || {};

//   const audioContextRef = useRef<AudioContext | null>(null);
//   const analyserRef = useRef<AnalyserNode | null>(null);
//   const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
//   const animationRef = useRef<number | null>(null);

//   const [occurrenceCount, setOccurrenceCount] = useState<number>(0);

//   useEffect(() => {
//     if (!range || !occurrenceLimit) {
//       alert('Invalid detection setup. Redirecting...');
//       history.push('/');
//       return;
//     }

//     const initAudio = async () => {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

//         audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
//         analyserRef.current = audioContextRef.current.createAnalyser();
//         analyserRef.current.minDecibels = -100;
//         analyserRef.current.maxDecibels = -10;
//         analyserRef.current.smoothingTimeConstant = 0.85;

//         sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
//         sourceRef.current.connect(analyserRef.current);

//         visualize();
//       } catch (err) {
//         alert('Microphone access is required.');
//       }
//     };

//     initAudio();

//     return () => {
//       if (animationRef.current) cancelAnimationFrame(animationRef.current);
//       audioContextRef.current?.close();
//     };
//   }, [range, occurrenceLimit, history]);

//   const visualize = () => {
//     if (!analyserRef.current) return;
//     const analyser = analyserRef.current;
//     const bufferLength = analyser.fftSize = 2048;
//     const dataArray = new Float32Array(bufferLength);

//     let detectingSound = false;
//     let detectionStartTime: number | null = null;

//     const draw = () => {
//       analyser.getFloatTimeDomainData(dataArray);

//       let crossings = 0;
//       for (let i = 1; i < bufferLength; i++) {
//         if ((dataArray[i - 1] < 0 && dataArray[i] >= 0)) {
//           crossings++;
//         }
//       }

//       const estimatedFrequency = (crossings * (audioContextRef.current?.sampleRate || 44100)) / bufferLength / 2;
//       const freq = Math.round(estimatedFrequency);

//       if (freq >= range.min && freq <= range.max) {
//         if (!detectingSound) {
//           detectingSound = true;
//           detectionStartTime = Date.now();
//         } else if (detectionStartTime && (Date.now() - detectionStartTime >= HOLD_TIME)) {
//           setOccurrenceCount((prev) => {
//             const newCount = prev + 1;
//             if (newCount >= occurrenceLimit) {
//               alert(`Detected ${newCount} occurrences!`);
//               cancelAnimationFrame(animationRef.current!);
//               return newCount;
//             }
//             return newCount;
//           });
//           detectionStartTime = null;
//           detectingSound = false;
//         }
//       } else {
//         detectingSound = false;
//         detectionStartTime = null;
//       }

//       animationRef.current = requestAnimationFrame(draw);
//     };

//     draw();
//   };

//   return (
//     <IonApp>
//       <IonPage>
//         <IonHeader>
//           <IonToolbar>
//             <IonTitle>Detecting Occurrences</IonTitle>
//           </IonToolbar>
//         </IonHeader>
//         <IonContent className="ion-padding">
//           <IonText>
//             <h2>Detected Occurrences:</h2>
//             <h1>{occurrenceCount} / {occurrenceLimit}</h1>
//           </IonText>
//           <IonButton expand="block" color="danger" onClick={() => history.push('/')}>Go Back</IonButton>
//         </IonContent>
//       </IonPage>
//     </IonApp>
//   );
// };

// export default DetectOccurrences;
