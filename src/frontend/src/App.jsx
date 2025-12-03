import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Upload, Type, Play, Square, Download, Trash2, Volume2, Activity, Sparkles, Globe, User, Loader2, X, Pause, Check, Sliders, RotateCcw } from 'lucide-react';

const API_URL = 'http://localhost:8000';

const EFFECTS = {
  noise_gate: { label: 'Noise Gate', desc: 'Silences audio below threshold', params: { threshold_db: { min: -100, max: 0, default: -40, unit: 'dB' } } },
  compressor: { label: 'Compressor', desc: 'Reduces dynamic range', params: { threshold_db: { min: -60, max: 0, default: -20, unit: 'dB' } } },
  highpass: { label: 'Highpass', desc: 'Removes low frequencies', params: { cutoff_frequency_hz: { min: 20, max: 1000, default: 80, unit: 'Hz' } } },
  lowpass: { label: 'Lowpass', desc: 'Removes high frequencies', params: { cutoff_frequency_hz: { min: 100, max: 15000, default: 5000, unit: 'Hz' } } },
  high_shelf: { label: 'High Shelf', desc: 'Boost/cut highs', params: { gain_db: { min: -20, max: 20, default: 0, unit: 'dB' } } },
  low_shelf: { label: 'Low Shelf', desc: 'Boost/cut lows', params: { gain_db: { min: -20, max: 20, default: 0, unit: 'dB' } } },
  peak: { label: 'Peak EQ', desc: 'Boost/cut frequency band', params: { gain_db: { min: -20, max: 20, default: 0, unit: 'dB' } } },
  ladder: { label: 'Ladder', desc: 'Moog-style filter', params: { cutoff_hz: { min: 100, max: 10000, default: 2000, unit: 'Hz' } } },
  phaser: { label: 'Phaser', desc: 'Sweeping phase effect', params: { rate_hz: { min: 0.1, max: 10, default: 1, unit: 'Hz' } } },
  chorus: { label: 'Chorus', desc: 'Rich shimmery doubling', params: { depth: { min: 0, max: 1, default: 0.5, unit: '' } } },
  delay: { label: 'Delay', desc: 'Echo effect', params: { delay_seconds: { min: 0, max: 1, default: 0.4, unit: 's' } } },
  reverb: { label: 'Reverb', desc: 'Room ambience', params: { room_size: { min: 0, max: 1, default: 0.5, unit: '' } } },
  distortion: { label: 'Distortion', desc: 'Overdrive and grit', params: { drive_db: { min: 0, max: 60, default: 25, unit: 'dB' } } },
  clipping: { label: 'Clipping', desc: 'Hard distortion', params: { threshold_db: { min: -40, max: 0, default: -6, unit: 'dB' } } },
  bitcrush: { label: 'Bitcrush', desc: 'Lo-fi bit reduction', params: { bit_depth: { min: 2, max: 16, default: 8, unit: 'bit' } } },
  gsm: { label: 'GSM', desc: 'Phone codec sound', params: {} },
  mp3: { label: 'MP3', desc: 'Compression artifacts', params: { vbr_quality: { min: 0, max: 9, default: 2, unit: '' } } },
  resample: { label: 'Resample', desc: 'Sample rate reduction', params: { target_sample_rate: { min: 1000, max: 16000, default: 8000, unit: 'Hz' } } },
  pitch_shift: { label: 'Pitch', desc: 'Shift pitch up/down', params: { semitones: { min: -12, max: 12, default: 0, unit: 'st' } } },
  gain: { label: 'Gain', desc: 'Volume control', params: { gain_db: { min: -20, max: 20, default: 0, unit: 'dB' } } },
  limiter: { label: 'Limiter', desc: 'Prevents clipping', params: { threshold_db: { min: -20, max: 0, default: -1, unit: 'dB' } } },
};

const PRESETS = {
  broadcast: { label: 'Broadcast', effects: { noise_gate: {}, highpass: {}, compressor: {}, limiter: {} } },
  walkie: { label: 'Walkie Talkie', effects: { highpass: { cutoff_frequency_hz: 400 }, lowpass: { cutoff_frequency_hz: 3000 }, gsm: {} } },
  helium: { label: 'Helium', effects: { pitch_shift: { semitones: 6 } } },
  underworld: { label: 'Underworld', effects: { pitch_shift: { semitones: -6 }, reverb: { room_size: 0.3 }, distortion: { drive_db: 15 } } },
  ethereal: { label: 'Ethereal', effects: { chorus: {}, delay: { delay_seconds: 0.3 }, reverb: { room_size: 0.8 } } },
  arcade: { label: 'Arcade', effects: { bitcrush: { bit_depth: 4 }, resample: { target_sample_rate: 8000 } } },
  robot: { label: 'Robot', effects: { bitcrush: { bit_depth: 6 }, resample: { target_sample_rate: 12000 }, chorus: { depth: 0.3 } } },
  underwater: { label: 'Underwater', effects: { lowpass: { cutoff_frequency_hz: 800 }, reverb: { room_size: 0.7 }, chorus: { depth: 0.4 } } },
  stadium: { label: 'Stadium', effects: { compressor: {}, delay: { delay_seconds: 0.25 }, reverb: { room_size: 0.9 } } },
  megaphone: { label: 'Megaphone', effects: { highpass: { cutoff_frequency_hz: 300 }, distortion: { drive_db: 20 }, compressor: {} } },
  alien: { label: 'Alien', effects: { pitch_shift: { semitones: 3 }, phaser: { rate_hz: 2 }, reverb: { room_size: 0.5 } } },
  vintage: { label: 'Vintage', effects: { lowpass: { cutoff_frequency_hz: 4000 }, mp3: { vbr_quality: 6 }, noise_gate: {} } },
  deep_fried: {
    label: 'Deep Fried',
    effects: {
      distortion: { drive_db: 50 },
      highpass: { cutoff_frequency_hz: 300 },
      mp3: { vbr_quality: 9 },
      compressor: { threshold_db: -30 }
    }
  },
  deeper_fried: {
    label: 'Deeper Fried',
    effects: {
      gain: { gain_db: 10 },
      compressor: { threshold_db: -35 },
      pitch_shift: { semitones: -1 },
      low_shelf: { gain_db: 14 },
      high_shelf: { gain_db: 6 },
      distortion: { drive_db: 45 },
      clipping: { threshold_db: -1 },
      resample: { target_sample_rate: 8000 },
      mp3: { vbr_quality: 7 },
    },
  },

};

const LANGUAGES = [
  'Arabic', 'Chinese', 'Danish', 'Dutch', 'Finnish', 'French', 'German', 'Greek',
  'Hebrew', 'Hindi', 'Italian', 'Japanese', 'Korean', 'Malay', 'Norwegian', 'Polish',
  'Portuguese', 'Russian', 'Spanish', 'Swahili', 'Swedish', 'Turkish'
];

const LOADING_PHRASES = [
  "Analyzing voice patterns...",
  "Extracting vocal characteristics...",
  "Mapping speech frequencies...",
  "Processing neural embeddings...",
  "Calibrating voice model...",
  "Synthesizing phonemes...",
  "Generating prosody...",
  "Applying voice texture...",
  "Fine-tuning resonance...",
  "Optimizing speech flow...",
  "Blending vocal features...",
  "Rendering audio waves...",
  "Polishing the output...",
  "Adding final touches...",
  "Almost there...",
  "Encoding speech patterns...",
  "Building voice profile...",
  "Computing spectrograms...",
  "Harmonizing frequencies...",
  "Weaving audio magic...",
];

// Compact waveform for recording
const LiveWaveform = ({ analyser, isActive }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!analyser || !isActive) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      ctx.fillStyle = 'rgb(30, 41, 59)';
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgb(52, 211, 153)';
      ctx.beginPath();
      const sliceWidth = rect.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * rect.height) / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
    };
    draw();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [analyser, isActive]);

  return <div ref={containerRef} className="w-full h-12 rounded bg-slate-800 overflow-hidden"><canvas ref={canvasRef} className="block" /></div>;
};

// Compact waveform with playback
const Waveform = ({ audioBlob, audioUrl, currentTime = 0, duration = 0, onSeek }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [waveformData, setWaveformData] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 300, height: 48 });
  const animationRef = useRef(null);
  const currentTimeRef = useRef(currentTime);

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => setDimensions({ width: container.getBoundingClientRect().width, height: 48 });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const source = audioBlob || audioUrl;
    if (!source) return;
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const process = async (buf) => {
      try {
        const data = await audioContext.decodeAudioData(buf);
        const raw = data.getChannelData(0);
        const samples = Math.max(100, Math.floor(dimensions.width / 3));
        const block = Math.floor(raw.length / samples);
        const filtered = [];
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < block; j++) sum += Math.abs(raw[i * block + j]);
          filtered.push(sum / block);
        }
        const max = Math.max(...filtered);
        setWaveformData(filtered.map(v => v / max));
        audioContext.close();
      } catch (e) { console.error(e); }
    };
    if (audioBlob) {
      const reader = new FileReader();
      reader.onload = (e) => process(e.target.result);
      reader.readAsArrayBuffer(audioBlob);
    } else if (audioUrl) {
      fetch(audioUrl).then(r => r.arrayBuffer()).then(process);
    }
  }, [audioBlob, audioUrl, dimensions.width]);

  useEffect(() => {
    if (!waveformData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = dimensions;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    const samples = waveformData.length;
    const barW = width / samples;
    const gap = Math.max(1, barW * 0.2);
    const draw = () => {
      const progress = duration > 0 ? currentTimeRef.current / duration : 0;
      const played = Math.floor(progress * samples);
      ctx.fillStyle = 'rgb(30, 41, 59)';
      ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < samples; i++) {
        const h = Math.max(2, waveformData[i] * height * 0.85);
        const x = i * barW + gap / 2;
        const y = (height - h) / 2;
        ctx.fillStyle = i < played ? 'rgb(52, 211, 153)' : 'rgb(71, 85, 105)';
        ctx.beginPath();
        ctx.roundRect(x, y, barW - gap, h, 1);
        ctx.fill();
      }
      animationRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [waveformData, duration, dimensions]);

  const handleClick = (e) => {
    if (!duration) return;
    const rect = canvasRef.current.getBoundingClientRect();
    onSeek?.((e.clientX - rect.left) / rect.width * duration);
  };

  return (
    <div ref={containerRef} className="w-full h-12 rounded bg-slate-800 overflow-hidden">
      <canvas ref={canvasRef} className="block cursor-pointer" onClick={handleClick} />
    </div>
  );
};

// Mini audio player
const AudioPlayer = ({ blob, url, onDelete, label }) => {
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const audioRef = useRef(null);
  const urlRef = useRef(null);

  useEffect(() => {
    const src = url || (blob ? URL.createObjectURL(blob) : null);
    if (!src) return;
    if (!url && blob) urlRef.current = src;
    const audio = new Audio(src);
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('timeupdate', () => setTime(audio.currentTime));
    audio.addEventListener('ended', () => { setPlaying(false); setTime(0); });
    audioRef.current = audio;
    return () => { audio.pause(); if (urlRef.current) URL.revokeObjectURL(urlRef.current); };
  }, [blob, url]);

  const toggle = () => { if (!audioRef.current) return; playing ? audioRef.current.pause() : audioRef.current.play(); setPlaying(!playing); };
  const seek = (t) => { if (audioRef.current) { audioRef.current.currentTime = t; setTime(t); } };
  const fmt = (t) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <button onClick={toggle} className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center transition shrink-0">
          {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <Waveform audioBlob={blob} audioUrl={url} currentTime={time} duration={duration} onSeek={seek} />
        </div>
        {onDelete && <button onClick={onDelete} className="p-1 text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>}
      </div>
      <div className="flex justify-between text-xs text-slate-500 px-10">
        <span>{fmt(time)}</span>
        <span>{fmt(duration)}</span>
      </div>
    </div>
  );
};

// Loading animation with cycling phrases
const LoadingDisplay = ({ stage, translatedText, translateTo }) => {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [shuffledPhrases, setShuffledPhrases] = useState([]);

  useEffect(() => {
    // Shuffle phrases on mount
    const shuffled = [...LOADING_PHRASES].sort(() => Math.random() - 0.5);
    setShuffledPhrases(shuffled);
  }, []);

  useEffect(() => {
    if (shuffledPhrases.length === 0) return;
    const interval = setInterval(() => {
      setPhraseIndex(i => (i + 1) % shuffledPhrases.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [shuffledPhrases]);

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-slate-700 rounded-full" />
        <div className="absolute inset-0 w-16 h-16 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin" />
      </div>

      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-slate-300">
          {stage === 'translating' ? 'Processing Speech' : 'Generating Voice'}
        </p>
        <p className="text-xs text-slate-500 h-4 transition-opacity duration-300">
          {shuffledPhrases[phraseIndex] || LOADING_PHRASES[0]}
        </p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2 mt-4">
        <div className={`w-3 h-3 rounded-full ${stage === 'translating' || stage === 'synthesizing' ? 'bg-emerald-500' : 'bg-slate-600'}`} />
        <div className={`w-8 h-0.5 ${stage === 'synthesizing' ? 'bg-emerald-500' : 'bg-slate-600'}`} />
        <div className={`w-3 h-3 rounded-full ${stage === 'synthesizing' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
      </div>

      {/* Show translated text immediately when available */}
      {translatedText && (
        <div className="mt-4 p-3 bg-slate-700/50 rounded-lg max-w-md text-center">
          <span className="text-xs text-emerald-400 block mb-1">
            ✓ {translateTo ? `Translated to ${translateTo}` : 'Transcribed'}
          </span>
          <p className="text-sm text-slate-300">"{translatedText}"</p>
        </div>
      )}
    </div>
  );
};

// Effect card - whole card clickable with protected slider zone
const EffectCard = ({ id, effect, isActive, params, onToggle, onParamChange }) => {
  const hasParams = Object.keys(effect.params).length > 0;

  return (
    <div
      onClick={onToggle}
      className={`rounded-lg px-2 py-1.5 transition ${isActive ? 'bg-purple-500/30 ring-1 ring-purple-500/50' : 'bg-slate-700/50 hover:bg-slate-700'}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${isActive ? 'text-purple-300' : 'text-slate-400'}`}>{effect.label}</span>
        {isActive && (
          <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shadow-lg shadow-purple-500/50" />
        )}
      </div>
      <p className={`text-xs leading-tight ${isActive ? 'text-purple-400/70' : 'text-slate-500'}`}>{effect.desc}</p>
      {isActive && hasParams ? (
        <div
          className="mt-1 pt-1 border-t border-purple-500/20"
          onClick={(e) => e.stopPropagation()}
        >
          {Object.entries(effect.params).map(([p, cfg]) => (
            <div key={p}>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{params[p]?.toFixed(p === 'semitones' || p === 'bit_depth' ? 0 : 1)}{cfg.unit}</span>
              </div>
              <input
                type="range"
                min={cfg.min}
                max={cfg.max}
                step={(cfg.max - cfg.min) / 50}
                value={params[p] ?? cfg.default}
                onChange={(e) => onParamChange(p, e.target.value)}
                className="w-full accent-purple-500 h-1.5 cursor-pointer"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className={`h-1 rounded mt-1 ${isActive ? 'bg-purple-500/50' : 'bg-slate-600/50'}`} />
      )}
    </div>
  );
};

export default function VoiceStudio() {
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');

  const [voiceBlob, setVoiceBlob] = useState(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceAnalyser, setVoiceAnalyser] = useState(null);
  const [contentMode, setContentMode] = useState('voice');
  const [contentBlob, setContentBlob] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [isRecordingContent, setIsRecordingContent] = useState(false);
  const [contentAnalyser, setContentAnalyser] = useState(null);
  const [translateTo, setTranslateTo] = useState(null);
  const [expressiveness, setExpressiveness] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.6);

  const [activeEffects, setActiveEffects] = useState({});
  const [currentStage, setCurrentStage] = useState('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawAudioBlob, setRawAudioBlob] = useState(null);
  const [outputAudioUrl, setOutputAudioUrl] = useState(null);
  const [translatedText, setTranslatedText] = useState('');
  const [isApplyingEffects, setIsApplyingEffects] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const effectsDebounceRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        setAudioDevices(inputs);
        if (inputs.length && !selectedDevice) setSelectedDevice(inputs[0].deviceId);
      } catch (e) { console.error(e); }
    };
    load();
  }, []);

  const canGenerate = voiceBlob && (contentMode === 'text' ? textInput.trim() : contentMode === 'voice' ? voiceBlob : contentBlob);

  const startRecording = async (type) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: selectedDevice ? { deviceId: { exact: selectedDevice } } : true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      if (type === 'voice') { setVoiceAnalyser(analyser); setIsRecordingVoice(true); }
      else { setContentAnalyser(analyser); setIsRecordingContent(true); }
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        if (type === 'voice') { setVoiceBlob(blob); setIsRecordingVoice(false); setVoiceAnalyser(null); }
        else { setContentBlob(blob); setIsRecordingContent(false); setContentAnalyser(null); }
        stream.getTracks().forEach(t => t.stop());
        ctx.close();
      };
      mediaRecorderRef.current.start();
    } catch (e) { alert('Mic error: ' + e.message); }
  };
  const stopRecording = () => mediaRecorderRef.current?.stop();
  const handleUpload = (e, type) => { const f = e.target.files?.[0]; if (f) type === 'voice' ? setVoiceBlob(f) : setContentBlob(f); };

  const toggleEffect = (id) => {
    setActiveEffects(prev => {
      if (prev[id]) { const { [id]: _, ...rest } = prev; return rest; }
      const defs = {};
      Object.entries(EFFECTS[id].params).forEach(([p, v]) => defs[p] = v.default);
      return { ...prev, [id]: defs };
    });
  };
  const updateParam = (id, p, v) => setActiveEffects(prev => ({ ...prev, [id]: { ...prev[id], [p]: parseFloat(v) } }));
  const loadPreset = (id) => {
    const preset = PRESETS[id];
    const fx = {};
    Object.entries(preset.effects).forEach(([k, v]) => {
      const defs = {};
      Object.entries(EFFECTS[k]?.params || {}).forEach(([p, d]) => defs[p] = v[p] ?? d.default);
      fx[k] = defs;
    });
    setActiveEffects(fx);
  };
  const clearEffects = () => setActiveEffects({});

  const applyEffects = useCallback(async (blob) => {
    if (!blob) return;
    setIsApplyingEffects(true);
    try {
      const form = new FormData();
      form.append('audio', blob, 'audio.wav');
      form.append('effects', JSON.stringify(activeEffects));
      const res = await fetch(`${API_URL}/api/apply-effects`, { method: 'POST', body: form });
      if (!res.ok) throw new Error('Effects failed');
      setOutputAudioUrl(URL.createObjectURL(await res.blob()));
    } catch (e) { console.error(e); }
    finally { setIsApplyingEffects(false); }
  }, [activeEffects]);

  useEffect(() => {
    if (!rawAudioBlob || isProcessing) return;
    if (effectsDebounceRef.current) clearTimeout(effectsDebounceRef.current);
    effectsDebounceRef.current = setTimeout(() => {
      Object.keys(activeEffects).length > 0 ? applyEffects(rawAudioBlob) : setOutputAudioUrl(URL.createObjectURL(rawAudioBlob));
    }, 300);
  }, [activeEffects, rawAudioBlob, isProcessing, applyEffects]);

  const generate = async () => {
    setIsProcessing(true); setError(null); setTranslatedText(''); setOutputAudioUrl(null);
    try {
      const voiceForm = new FormData();
      voiceForm.append('file', voiceBlob);
      await fetch(`${API_URL}/api/celebrity-voice`, { method: 'POST', body: voiceForm });

      const audio = contentMode === 'voice' ? voiceBlob : contentBlob;
      let text = textInput;

      if (contentMode !== 'text' && audio) {
        setCurrentStage('translating');
        const form = new FormData();
        form.append('audio', audio, 'audio.wav');
        form.append('translate_to', translateTo || 'English');
        const res = await fetch(`${API_URL}/api/translate`, { method: 'POST', body: form });
        if (!res.ok) throw new Error('Translation failed');
        text = (await res.json()).translated_text;
        setTranslatedText(text); // Show immediately!
      }

      setCurrentStage('synthesizing');
      const form = new FormData();
      form.append('text', text);
      form.append('language', translateTo || 'English');
      form.append('expressiveness', expressiveness.toString());
      form.append('similarity', similarity.toString());
      const res = await fetch(`${API_URL}/api/synthesize`, { method: 'POST', body: form });
      if (!res.ok) throw new Error('Synthesis failed');

      const blob = await res.blob();
      setRawAudioBlob(blob);
      Object.keys(activeEffects).length > 0 ? await applyEffects(blob) : setOutputAudioUrl(URL.createObjectURL(blob));
      setCurrentStage('done');
    } catch (e) { setError(e.message); setCurrentStage('error'); }
    finally { setIsProcessing(false); }
  };

  useEffect(() => {
    setRawAudioBlob(null); setOutputAudioUrl(null); setTranslatedText(''); setCurrentStage('idle');
  }, [voiceBlob, contentBlob, textInput, translateTo, contentMode]);

  const effectCount = Object.keys(activeEffects).length;

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-1">
          <img src="./lyre_logo.png" alt="Lyre" className="w-10 h-10" />
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent leading-tight">Lyre Studio</h1>
            <span className="text-xs text-slate-500">Clone any voice. Speak any language. Have fun with effects!</span>
          </div>
        </div>
        {audioDevices.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-1.5">
            <Mic size={14} className="text-emerald-400" />
            <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)} className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer">
              {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default Microphone'}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left: Inputs */}
        <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto">
          {/* Voice Sample */}
          <div className="bg-slate-800/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <User size={14} className="text-cyan-400" />
              <span className="text-sm font-medium">Voice to Clone</span>
            </div>
            {voiceBlob ? (
              <AudioPlayer blob={voiceBlob} onDelete={() => setVoiceBlob(null)} />
            ) : isRecordingVoice ? (
              <div className="space-y-2">
                <LiveWaveform analyser={voiceAnalyser} isActive={isRecordingVoice} />
                <button onClick={stopRecording} className="w-full py-2 rounded bg-red-500 text-sm flex items-center justify-center gap-2"><Square size={14} /> Stop</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => startRecording('voice')} className="flex-1 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm flex items-center justify-center gap-1"><Mic size={14} /> Record</button>
                <label className="flex-1 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm flex items-center justify-center gap-1 cursor-pointer"><Upload size={14} /> Upload<input type="file" accept="audio/*" className="hidden" onChange={(e) => handleUpload(e, 'voice')} /></label>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="bg-slate-800/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Type size={14} className="text-emerald-400" />
              <span className="text-sm font-medium">Content</span>
            </div>
            <div className="flex gap-1 mb-2">
              {[['voice', 'Use Voice'], ['record', 'Record'], ['text', 'Type']].map(([m, l]) => (
                <button key={m} onClick={() => setContentMode(m)} disabled={m === 'voice' && !voiceBlob} className={`flex-1 py-1 rounded text-xs transition ${contentMode === m ? 'bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600 disabled:opacity-40'}`}>{l}</button>
              ))}
            </div>
            {contentMode === 'voice' ? (
              voiceBlob ? <p className="text-xs text-emerald-400 flex items-center gap-1"><Check size={12} /> Using voice sample</p> : <p className="text-xs text-slate-500">Record voice first</p>
            ) : contentMode === 'record' ? (
              contentBlob ? <AudioPlayer blob={contentBlob} onDelete={() => setContentBlob(null)} /> : isRecordingContent ? (
                <div className="space-y-2">
                  <LiveWaveform analyser={contentAnalyser} isActive={isRecordingContent} />
                  <button onClick={stopRecording} className="w-full py-2 rounded bg-red-500 text-sm flex items-center justify-center gap-2"><Square size={14} /> Stop</button>
                </div>
              ) : (
                <button onClick={() => startRecording('content')} className="w-full py-2 rounded bg-emerald-500 hover:bg-emerald-600 text-sm flex items-center justify-center gap-1"><Mic size={14} /> Record</button>
              )
            ) : (
              <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Type here..." className="w-full h-16 bg-slate-700/50 rounded p-2 text-sm resize-none" />
            )}
          </div>

          {/* Language */}
          <div className="bg-slate-800/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Globe size={14} className="text-amber-400" />
              <span className="text-sm font-medium">Translate to</span>
            </div>
            <select value={translateTo || ''} onChange={(e) => setTranslateTo(e.target.value || null)} className="w-full bg-slate-700 rounded px-2 py-1.5 text-sm">
              <option value="">None (keep original)</option>
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>

            {/* Voice Settings - collapsible */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-full mt-3 pt-3 border-t border-slate-700 flex items-center justify-between text-sm text-slate-400 hover:text-slate-300"
            >
              <span className="flex items-center gap-2">
                <Sliders size={12} />
                Voice Settings
              </span>
              <span className="text-xs">{showSettings ? '▲' : '▼'}</span>
            </button>
            {showSettings && (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Expressiveness</span><span className="text-slate-500">{expressiveness.toFixed(2)}</span></div>
                  <input type="range" min={0} max={1} step={0.05} value={expressiveness} onChange={(e) => setExpressiveness(parseFloat(e.target.value))} className="w-full accent-pink-500 h-1.5 cursor-pointer" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Similarity</span><span className="text-slate-500">{similarity.toFixed(2)}</span></div>
                  <input type="range" min={0} max={1} step={0.05} value={similarity} onChange={(e) => setSimilarity(parseFloat(e.target.value))} className="w-full accent-pink-500 h-1.5 cursor-pointer" />
                </div>
              </div>
            )}
          </div>

          {/* Generate */}
          <button onClick={generate} disabled={!canGenerate || isProcessing} className="py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 font-medium flex items-center justify-center gap-2 disabled:opacity-40 transition hover:opacity-90 shrink-0">
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            {isProcessing ? 'Processing...' : 'Generate'}
          </button>
        </div>

        {/* Right: Output & Effects */}
        <div className="flex-1 flex flex-col bg-slate-800/30 rounded-xl p-4 min-w-0">
          {/* Effects section - always visible */}
          <div className="shrink-0 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-purple-400" />
              <span className="text-sm font-medium">Effects</span>
              {effectCount > 0 && <span className="text-xs text-purple-400 bg-purple-500/20 px-1.5 rounded">{effectCount}</span>}
              {isApplyingEffects && <Loader2 size={12} className="animate-spin text-purple-400" />}
              {rawAudioBlob && !isApplyingEffects && effectCount > 0 && (
                <span className="text-xs text-emerald-400/70 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              )}
              <div className="flex-1" />
              {effectCount > 0 && (
                <button onClick={clearEffects} className="px-2 py-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-md flex items-center gap-1 transition">
                  <RotateCcw size={12} /> Clear All
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-slate-500">Presets:</span>
              <div className="flex gap-1 flex-wrap">
                {Object.entries(PRESETS).map(([id, p]) => (
                  <button key={id} onClick={() => loadPreset(id)} className="px-2 py-0.5 rounded text-sm bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-300 transition">{p.label}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {Object.entries(EFFECTS).map(([id, fx]) => (
                <EffectCard key={id} id={id} effect={fx} isActive={!!activeEffects[id]} params={activeEffects[id] || {}} onToggle={() => toggleEffect(id)} onParamChange={(p, v) => updateParam(id, p, v)} />
              ))}
            </div>
          </div>

          {/* Output area */}
          <div className="flex-1 flex flex-col justify-center min-h-0">
            {error && <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20 text-red-400 text-sm mb-3"><X size={14} className="inline mr-1" /> {error}</div>}

            {isProcessing && (
              <LoadingDisplay stage={currentStage} translatedText={translatedText} translateTo={translateTo} />
            )}

            {!isProcessing && !outputAudioUrl && currentStage === 'idle' && (
              <div className="text-center text-slate-500">
                <Volume2 size={48} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Your generated audio will appear here</p>
              </div>
            )}

            {!isProcessing && outputAudioUrl && (
              <div className="space-y-3">
                {translatedText && (
                  <div className="p-3 bg-slate-700/30 rounded-lg">
                    <span className="text-xs text-emerald-400 block mb-1">✓ {translateTo ? `Translated to ${translateTo}` : 'Transcribed'}</span>
                    <p className="text-sm text-slate-300">"{translatedText}"</p>
                  </div>
                )}
                <AudioPlayer url={outputAudioUrl} label="Output" />
                <a href={outputAudioUrl} download="voice_studio.wav" className="flex items-center justify-center gap-2 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition text-sm">
                  <Download size={16} /> Download
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}