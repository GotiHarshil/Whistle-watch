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
  IonIcon,
  IonCard,
  IonCardContent,
  IonBadge,
} from "@ionic/react";
import {
  micOutline,
  micOffOutline,
  playOutline,
  stopOutline,
  alertCircleOutline,
  radioOutline,
  volumeHighOutline,
  repeatOutline,
} from "ionicons/icons";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

import "./Home.css";

const WINDOW_SIZE = 800; // Hz (Range)
const HOLD_TIME_RANGE_CAPTURE = 1000; // ms - Time to detect range
const HOLD_TIME_OCCURRENCE = 800; // ms - Minimum time to detect single occurrence
const FREQUENCY_BUFFER = 5; // Hz - Minimal buffer on each side of the range
const ROLLING_WINDOW_SIZE = 50; // Number of samples to keep in rolling window
const SMOOTHING_WINDOW_SIZE = 5; // Number of samples for frequency smoothing

const Home: React.FC = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
  const hasCompletedHoldTimeRef = useRef<boolean>(false);

  const frequencyHistoryRef = useRef<number[]>([]);
  const smoothedFrequencyRef = useRef<number[]>([]);

  const secondDataRef = useRef<{ startTime: number; frequencies: number[] }>({
    startTime: Date.now(),
    frequencies: [],
  });

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
        analyserRef.current.smoothingTimeConstant = 0.8; // Increased smoothing
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

  const calculateSmoothedFrequency = (currentFreq: number): number => {
    smoothedFrequencyRef.current.push(currentFreq);
    if (smoothedFrequencyRef.current.length > SMOOTHING_WINDOW_SIZE) {
      smoothedFrequencyRef.current.shift();
    }

    // Calculate exponential moving average
    const alpha = 0.3; // Smoothing factor (0 < alpha < 1)
    let smoothed = smoothedFrequencyRef.current[0];

    for (let i = 1; i < smoothedFrequencyRef.current.length; i++) {
      smoothed =
        alpha * smoothedFrequencyRef.current[i] + (1 - alpha) * smoothed;
    }

    return Math.round(smoothed);
  };

  const startListening = () => {
    if (!analyserRef.current) return;
    setListening(true);
    setRange(null);
    visualizeCaptureRange();
  };

  const stopListening = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setListening(false);
  };

  const drawWaveform = () => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Get frequency data instead of time domain data
    analyser.getByteFrequencyData(dataArray);

    // Clear canvas
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw frequency bars
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;

      // Use gradient for better visualization
      const gradient = ctx.createLinearGradient(
        0,
        canvas.height,
        0,
        canvas.height - barHeight
      );
      gradient.addColorStop(0, "rgba(99, 102, 241, 0.2)");
      gradient.addColorStop(1, "rgba(99, 102, 241, 1)");

      ctx.fillStyle = gradient;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

      x += barWidth + 1;
    }

    // Draw frequency line
    if (range) {
      const normalizedFreq = (frequency - range.min) / (range.max - range.min);
      const xPos = normalizedFreq * canvas.width;

      ctx.beginPath();
      ctx.strokeStyle = "rgb(239, 68, 68)";
      ctx.lineWidth = 2;
      ctx.moveTo(xPos, 0);
      ctx.lineTo(xPos, canvas.height);
      ctx.stroke();
    }
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

      const rawFreq = Math.round(
        (crossings * (audioContextRef.current?.sampleRate || 44100)) /
          bufferLength /
          2
      );

      // Apply smoothing
      const smoothedFreq = calculateSmoothedFrequency(rawFreq);
      setFrequency(smoothedFreq);

      // Draw waveform
      drawWaveform();

      if (smoothedFreq > 0) {
        const currentTime = Date.now();
        const elapsedTime = currentTime - secondDataRef.current.startTime;

        // Add frequency to current second's data
        secondDataRef.current.frequencies.push(smoothedFreq);

        // Update range every second
        if (elapsedTime >= 1000) {
          if (secondDataRef.current.frequencies.length > 0) {
            const minFreq = Math.min(...secondDataRef.current.frequencies);
            const maxFreq = Math.max(...secondDataRef.current.frequencies);

            setRange({
              min: minFreq - FREQUENCY_BUFFER,
              max: maxFreq + FREQUENCY_BUFFER,
            });
          }

          // Reset for next second
          secondDataRef.current = {
            startTime: currentTime,
            frequencies: [],
          };
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const playAlertSound = async () => {
    if (audioContextRef.current) {
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);

      // Configure the sound
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(
        800,
        audioContextRef.current.currentTime
      );
      gainNode.gain.setValueAtTime(0.5, audioContextRef.current.currentTime);

      // Play the sound
      oscillator.start();

      // Trigger haptic feedback for alert
      await Haptics.impact({ style: ImpactStyle.Heavy });

      // Stop after 500ms
      setTimeout(() => {
        oscillator.stop();
        gainNode.disconnect();
      }, 500);
    }
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

      const rawFreq = Math.round(
        (crossings * (audioContextRef.current?.sampleRate || 44100)) /
          bufferLength /
          2
      );

      // Apply smoothing
      const smoothedFreq = calculateSmoothedFrequency(rawFreq);
      setFrequency(smoothedFreq);

      if (smoothedFreq >= range.min && smoothedFreq <= range.max) {
        if (!isSoundInRangeRef.current) {
          isSoundInRangeRef.current = true;
          occurrenceDetectionStartRef.current = Date.now();
          hasCompletedHoldTimeRef.current = false;
        } else if (
          occurrenceDetectionStartRef.current &&
          Date.now() - occurrenceDetectionStartRef.current >=
            HOLD_TIME_OCCURRENCE
        ) {
          hasCompletedHoldTimeRef.current = true;
        }
      } else {
        if (isSoundInRangeRef.current && hasCompletedHoldTimeRef.current) {
          setOccurrenceCount((prev) => {
            const newCount = prev + 1;
            if (newCount >= occurrenceLimit) {
              playAlertSound();
              cancelAnimationFrame(animationRef.current!);
              setCheckingOccurrences(false);
            }
            // Trigger haptic feedback when occurrence is detected
            Haptics.impact({ style: ImpactStyle.Medium });
            return newCount;
          });
        }
        isSoundInRangeRef.current = false;
        occurrenceDetectionStartRef.current = null;
        hasCompletedHoldTimeRef.current = false;
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

    // Start waveform visualization
    const visualizeWaveform = () => {
      if (!analyserRef.current || !canvasRef.current) return;
      const analyser = analyserRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      // Clear canvas
      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgb(99, 102, 241)";
      ctx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        // Use gradient for better visualization
        const gradient = ctx.createLinearGradient(
          0,
          canvas.height,
          0,
          canvas.height - barHeight
        );
        gradient.addColorStop(0, "rgba(99, 102, 241, 0.2)");
        gradient.addColorStop(1, "rgba(99, 102, 241, 1)");

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, sliceWidth, barHeight);

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Draw frequency line
      if (range) {
        const normalizedFreq =
          (frequency - range.min) / (range.max - range.min);
        const xPos = normalizedFreq * canvas.width;

        ctx.beginPath();
        ctx.strokeStyle = "rgb(239, 68, 68)";
        ctx.lineWidth = 2;
        ctx.moveTo(xPos, 0);
        ctx.lineTo(xPos, canvas.height);
        ctx.stroke();
      }

      if (checkingOccurrences) {
        animationRef.current = requestAnimationFrame(visualizeWaveform);
      }
    };

    // Start both visualization and occurrence checking
    visualizeWaveform();
    visualizeCheckOccurrences();
  };

  return (
    <IonApp>
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>
              <IonIcon
                icon={radioOutline}
                style={{
                  marginRight: "8px",
                  verticalAlign: "middle",
                  fontSize: "24px",
                  color: "var(--primary-color)",
                }}
                className="floating"
              />
              Audio Frequency Detection
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent
          className="ion-padding wave-background animated-entry"
          style={{ "--background": "#ffffff" }}
        >
          <IonCard className="frequency-card glassmorphism">
            <IonCardContent>
              <div className="frequency-display">
                <h2>Current Frequency</h2>
                <canvas
                  ref={canvasRef}
                  width="300"
                  height="150"
                  style={{
                    width: "100%",
                    height: "150px",
                    background: "white",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color)",
                  }}
                />
                <h1>{frequency} Hz</h1>
              </div>
            </IonCardContent>
          </IonCard>

          <IonCard className="range-card glassmorphism">
            <IonCardContent>
              <div className="range-display">
                <div style={{ display: "inline-flex" }}>
                  <h2>Captured Range</h2>
                  &nbsp;
                  <IonIcon
                    icon={radioOutline}
                    className="range-icon"
                    style={{
                      fontSize: "24px",
                      marginBottom: "8px",
                      color: "var(--primary-color)",
                    }}
                  />
                </div>

                <h1>{range ? `${range.min} Hz - ${range.max} Hz` : "—"}</h1>
              </div>
            </IonCardContent>
          </IonCard>

          <IonButton
            expand="block"
            onClick={listening ? stopListening : startListening}
            className={listening ? "stop-button" : "start-button"}
          >
            <IonIcon
              slot="start"
              icon={listening ? micOffOutline : micOutline}
            />
            {listening ? "Stop Listening" : "Start Listening"}
          </IonButton>

          <IonCard className="input-card">
            <IonCardContent>
              <IonItem className="custom-input-container" lines="none">
                <IonLabel position="stacked">
                  <IonIcon
                    icon={repeatOutline}
                    style={{
                      marginRight: "8px",
                      verticalAlign: "middle",
                      color: "var(--primary-color)",
                    }}
                  />
                  Number of Occurrences
                </IonLabel>
                <IonInput
                  className="custom-input-field"
                  type="number"
                  value={occurrenceLimit}
                  min={1}
                  placeholder="e.g., 3"
                  disabled={checkingOccurrences}
                  onIonChange={(e) => {
                    const val = Number(e.detail.value);
                    setOccurrenceLimit(val > 0 ? Math.floor(val) : 1);
                  }}
                />
              </IonItem>
            </IonCardContent>
          </IonCard>

          <IonButton
            expand="block"
            onClick={startCheckingOccurrences}
            disabled={checkingOccurrences}
            className="check-button"
          >
            <IonIcon slot="start" icon={playOutline} />
            Start Counting
          </IonButton>

          {checkingOccurrences && (
            <IonCard className="occurrence-card">
              <IonCardContent>
                <div className="occurrence-display">
                  <h2>Detected Occurrences</h2>
                  <div className="occurrence-count">
                    <IonBadge color="primary" className="count-badge">
                      {occurrenceCount}
                    </IonBadge>
                    <span className="count-separator">/</span>
                    <IonBadge color="medium" className="limit-badge">
                      {occurrenceLimit}
                    </IonBadge>
                  </div>
                </div>
              </IonCardContent>
            </IonCard>
          )}
        </IonContent>
      </IonPage>
    </IonApp>
  );
};

export default Home;
