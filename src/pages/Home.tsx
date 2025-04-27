import { useEffect, useRef, useState } from "react";
import {
  IonApp,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButton,
  IonText,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
} from "@ionic/react";

const WINDOW_SIZE = 1000; // Hz
const HOLD_TIME_RANGE_CAPTURE = 400; // ms
const HOLD_TIME_OCCURRENCE = 1000; // ms

const Home: React.FC = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const [frequency, setFrequency] = useState<number>(0);
  const [range, setRange] = useState<{ min: number; max: number } | null>(null);
  const [listening, setListening] = useState(false);
  const [occurrenceLimit, setOccurrenceLimit] = useState<number>(0);
  const [occurrenceCount, setOccurrenceCount] = useState<number>(0);
  const [checkingOccurrences, setCheckingOccurrences] = useState(false);

  const windowStartRef = useRef<number | null>(null);
  const windowMinRef = useRef<number>(Infinity);
  const windowMaxRef = useRef<number>(-Infinity);
  const lastWindowRef = useRef<{ min: number; max: number } | null>(null);

  const occurrenceDetectionStartRef = useRef<number | null>(null);
  const isSoundInRangeRef = useRef<boolean>(false);

  useEffect(() => {
    const initAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        audioContextRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.minDecibels = -100;
        analyserRef.current.maxDecibels = -10;
        analyserRef.current.smoothingTimeConstant = 0.85;
        sourceRef.current =
          audioContextRef.current.createMediaStreamSource(stream);
        sourceRef.current.connect(analyserRef.current);
      } catch (err) {
        alert("Microphone access is required.");
      }
    };
    initAudio();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      audioContextRef.current?.close();
    };
  }, []);

  const startListening = () => {
    if (!analyserRef.current) return;
    console.log("working 1...");

    setListening(true);
    setRange(null);

    visualizeCaptureRange();
    console.log("working 2...");
  };

  const stopListening = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setListening(false);
  };

  const visualizeCaptureRange = () => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const bufferLength = (analyser.fftSize = 2048);
    const dataArray = new Float32Array(bufferLength);

    const draw = () => {
      analyser.getFloatTimeDomainData(dataArray);

      let crossings = 0;
      for (let i = 1; i < bufferLength; i++) {
        if (dataArray[i - 1] < 0 && dataArray[i] >= 0) crossings++;
      }

      const freq = Math.round(
        (crossings * (audioContextRef.current?.sampleRate || 44100)) /
          bufferLength /
          2
      );
      setFrequency(freq);

      if (freq > 0) {
        if (windowStartRef.current === null) {
          windowStartRef.current = Date.now();
          windowMinRef.current = freq;
          windowMaxRef.current = freq;
        } else {
          windowMinRef.current = Math.min(windowMinRef.current, freq);
          windowMaxRef.current = Math.max(windowMaxRef.current, freq);

          if (windowMaxRef.current - windowMinRef.current > WINDOW_SIZE) {
            windowStartRef.current = Date.now();
            windowMinRef.current = freq;
            windowMaxRef.current = freq;
          } else if (
            Date.now() - windowStartRef.current >=
            HOLD_TIME_RANGE_CAPTURE
          ) {
            setRange({
              min: windowMinRef.current - 100,
              max: windowMaxRef.current + 100,
            });
            cancelAnimationFrame(animationRef.current!); // Stop after capturing
          }
        }
      } else {
        windowStartRef.current = null;
        windowMinRef.current = Infinity;
        windowMaxRef.current = -Infinity;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const visualizeCheckOccurrences = () => {
    if (!analyserRef.current || !range) return;
    const analyser = analyserRef.current;
    const bufferLength = (analyser.fftSize = 2048);
    const dataArray = new Float32Array(bufferLength);

    const draw = () => {
      analyser.getFloatTimeDomainData(dataArray);

      let crossings = 0;
      for (let i = 1; i < bufferLength; i++) {
        if (dataArray[i - 1] < 0 && dataArray[i] >= 0) crossings++;
      }

      const freq = Math.round(
        (crossings * (audioContextRef.current?.sampleRate || 44100)) /
          bufferLength /
          2
      );
      setFrequency(freq);

      if (freq >= range.min && freq <= range.max) {
        if (!isSoundInRangeRef.current) {
          isSoundInRangeRef.current = true;
          occurrenceDetectionStartRef.current = Date.now();
        } else if (
          occurrenceDetectionStartRef.current &&
          Date.now() - occurrenceDetectionStartRef.current >=
            HOLD_TIME_OCCURRENCE
        ) {
          setOccurrenceCount((prev) => {
            const newCount = prev + 1;
            if (newCount >= occurrenceLimit) {
              alert(`Detected ${newCount} occurrences!`);
              cancelAnimationFrame(animationRef.current!);
              setCheckingOccurrences(false);
            }
            return newCount;
          });
          isSoundInRangeRef.current = false;
          occurrenceDetectionStartRef.current = null;
        }
      } else {
        isSoundInRangeRef.current = false;
        occurrenceDetectionStartRef.current = null;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const visualize = () => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const bufferLength = (analyser.fftSize = 2048);
    const dataArray = new Float32Array(bufferLength);

    const draw = () => {
      analyser.getFloatTimeDomainData(dataArray);

      let crossings = 0;
      for (let i = 1; i < bufferLength; i++) {
        if (dataArray[i - 1] < 0 && dataArray[i] >= 0) crossings++;
      }

      const estimatedFrequency =
        (crossings * (audioContextRef.current?.sampleRate || 44100)) /
        bufferLength /
        2;
      const freq = Math.round(estimatedFrequency);
      setFrequency(freq);

      // Capturing Range
      if (!checkingOccurrences && !range) {
        if (freq > 0) {
          if (windowStartRef.current === null) {
            windowStartRef.current = Date.now();
            windowMinRef.current = freq;
            windowMaxRef.current = freq;
          } else {
            windowMinRef.current = Math.min(windowMinRef.current, freq);
            windowMaxRef.current = Math.max(windowMaxRef.current, freq);

            if (windowMaxRef.current - windowMinRef.current > WINDOW_SIZE) {
              windowStartRef.current = Date.now();
              windowMinRef.current = freq;
              windowMaxRef.current = freq;
            } else if (
              Date.now() - windowStartRef.current >=
              HOLD_TIME_RANGE_CAPTURE
            ) {
              setRange({
                min: windowMinRef.current - 100,
                max: windowMaxRef.current + 100,
              });
              lastWindowRef.current = {
                min: windowMinRef.current - 100,
                max: windowMaxRef.current + 100,
              };
              cancelAnimationFrame(animationRef.current!); // stop the old animation
            }
          }
        } else {
          windowStartRef.current = null;
          windowMinRef.current = Infinity;
          windowMaxRef.current = -Infinity;
        }
      }

      // Checking Occurrences
      if (checkingOccurrences && range) {
        if (freq >= range.min && freq <= range.max) {
          if (!isSoundInRangeRef.current) {
            isSoundInRangeRef.current = true;
            occurrenceDetectionStartRef.current = Date.now();
          } else if (
            occurrenceDetectionStartRef.current &&
            Date.now() - occurrenceDetectionStartRef.current >=
              HOLD_TIME_OCCURRENCE
          ) {
            setOccurrenceCount((prev) => {
              const newCount = prev + 1;
              if (newCount >= occurrenceLimit) {
                alert(`Detected ${newCount} occurrences!`);
                stopListening();
                setCheckingOccurrences(false);
              }
              return newCount;
            });
            isSoundInRangeRef.current = false;
            occurrenceDetectionStartRef.current = null;
          }
        } else {
          isSoundInRangeRef.current = false;
          occurrenceDetectionStartRef.current = null;
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };
    draw();
  };

  const startCheckingOccurrences = () => {
    if (!range) {
      alert("Please capture a frequency range first!");
      return;
    }
    if (occurrenceLimit <= 0) {
      alert("Please enter a valid occurrence limit!");
      return;
    }
    setOccurrenceCount(0);
    setCheckingOccurrences(true);
    visualizeCheckOccurrences();

    // if (!listening) startListening();
  };

  return (
    <IonApp>
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Audio Frequency Detection</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonText>
            <h2>Current Frequency:</h2>
            <h1>{frequency} Hz</h1>
            <h2>Captured Range:</h2>
            <h1>{range ? `${range.min} Hz - ${range.max} Hz` : "—"}</h1>
          </IonText>

          <IonButton
            expand="block"
            onClick={listening ? stopListening : startListening}
          >
            {listening ? "Stop Listening" : "Start Listening"}
          </IonButton>

          <IonItem className="custom-input-container" lines="none">
            <IonLabel
              position="stacked"
              style={{ fontWeight: 600, fontSize: 18 }}
            >
              Number of Occurrences
            </IonLabel>
            <IonInput
              className="custom-input-field"
              type="number"
              value={occurrenceLimit}
              min={1}
              placeholder="e.g., 3"
              disabled={checkingOccurrences}
              style={{
                background: "#f4f5f8",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: 20,
                marginTop: 8,
                textAlign: "center",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                border: "1px solid #d1d1d1",
              }}
              onIonChange={(e) => {
                const val = Number(e.detail.value);
                setOccurrenceLimit(val > 0 ? Math.floor(val) : 1);
              }}
            />
          </IonItem>

          <IonButton
            expand="block"
            onClick={startCheckingOccurrences}
            disabled={checkingOccurrences}
          >
            Start Checking
          </IonButton>

          <IonButton
            expand="block"
            color="danger"
            onClick={() => {
              setCheckingOccurrences(false);
              setOccurrenceCount(0);
              isSoundInRangeRef.current = false;
              occurrenceDetectionStartRef.current = null;
            }}
            disabled={!checkingOccurrences}
          >
            Stop Checking
          </IonButton>

          {checkingOccurrences && (
            <IonText>
              <h2>Detected Occurrences:</h2>
              <h1>
                {occurrenceCount} / {occurrenceLimit}
              </h1>
            </IonText>
          )}
        </IonContent>
      </IonPage>
    </IonApp>
  );
};

export default Home;
