import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Upload, Type, Play, Square, Download, Trash2, Volume2, Activity, Sparkles, Globe, User, Loader2, X, Pause, Check, Sliders, RotateCcw, LogOut, HelpCircle } from 'lucide-react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Login from './auth/Login';

// Use backend directly for local dev, relative URL for cloud (proxied)
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocalDev ? 'http://localhost:8000' : '';

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
  walkie: { label: 'Walkie Talkie', effects: { highpass: { cutoff_frequency_hz: 400 }, lowpass: { cutoff_frequency_hz: 3000 }, gsm: {}, distortion: { drive_db: 10 } } },
  helium: { label: 'Helium', effects: { pitch_shift: { semitones: 6 } } },
  underworld: { label: 'Underworld', effects: { pitch_shift: { semitones: -6 }, reverb: { room_size: 0.3 }, distortion: { drive_db: 15 } } },
  ethereal: { label: 'Ethereal', effects: { chorus: {}, delay: { delay_seconds: 0.05 }, reverb: { room_size: 0.8 } } },
  eightbit: { label: '8-bit', effects: { bitcrush: { bit_depth: 4 }, resample: { target_sample_rate: 8000 } } },
  robot: { label: 'Robot', effects: { bitcrush: { bit_depth: 6 }, resample: { target_sample_rate: 12000 }, chorus: { depth: 0.3 } } },
  underwater: { label: 'Underwater', effects: { lowpass: { cutoff_frequency_hz: 800 }, reverb: { room_size: 0.7 }, chorus: { depth: 0.4 } } },
  echo: { label: 'Echo', effects: { compressor: {}, delay: { delay_seconds: 0.25 }, reverb: { room_size: 0.9 } } },
  megaphone: { label: 'Megaphone', effects: { highpass: { cutoff_frequency_hz: 300 }, distortion: { drive_db: 20 }, compressor: {} } },
  alien: { label: 'Alien', effects: { pitch_shift: { semitones: 3 }, phaser: { rate_hz: 2 }, reverb: { room_size: 0.5 } } },
  vintage: {
    label: 'Vintage',
    effects: {
      highpass: { cutoff_frequency_hz: 500 },
      lowpass: { cutoff_frequency_hz: 2500 },
      gsm: {},
      distortion: { drive_db: 12 },
      bitcrush: { bit_depth: 12 },
    }
  },
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

const GRANDIOSE_TERMS = [
  'fortissimo', 'crescendo', 'cadenza', 'arpeggio', 'virtuoso',
  'maestoso', 'grandioso', 'rhapsody', 'fantasia', 'intermezzo',
  'sinfonia', 'concerto', 'requiem', 'nocturne', 'scherzo',
  'fugue', 'overture', 'sonata', 'etude', 'ballade',
  'impromptu', 'polonaise', 'bolero', 'serenata', 'rondo',
  'toccata', 'prelude', 'cantata', 'oratorio', 'madrigal',
  'vivace', 'allegro', 'andante', 'adagio', 'presto',
  'legato', 'staccato', 'tremolo', 'vibrato', 'dolce',
  'chanson', 'berceuse', 'pavane', 'aubade', 'reverie',
  'lied', 'walzer', 'klang', 'fandango', 'habanera',
  'fado', 'serenade', 'minuet', 'gavotte', 'mazurka',
  'tarantella', 'aria', 'duet', 'opus', 'finale',
  'ensemble', 'symphony', 'harmony', 'melody', 'tempo',
  'diminuendo', 'fermata', 'cantabile', 'bravura'
];

const generateFilename = () => {
  const term = GRANDIOSE_TERMS[Math.floor(Math.random() * GRANDIOSE_TERMS.length)];
  const timestamp = Date.now().toString(36);
  return `lyre_${term}_${timestamp}.wav`;
};

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
      className={`rounded-lg px-2 py-1.5 transition cursor-pointer ${isActive ? 'bg-purple-500/30 ring-1 ring-purple-500/50' : 'bg-slate-700/50 hover:bg-slate-700'}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${isActive ? 'text-purple-300' : 'text-slate-400'}`}>{effect.label}</span>
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

function VoiceStudioContent() {
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const { user, token, logout, isLocal } = useAuth();

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
  const [showHelp, setShowHelp] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const effectsDebounceRef = useRef(null);

  // Helper to fetch with auth token
  const authenticatedFetch = async (url, options = {}) => {
    const headers = { ...options.headers };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
  };

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
      const res = await authenticatedFetch(`${API_URL}/api/apply-effects`, { method: 'POST', body: form });
      if (!res.ok) throw new Error('Effects failed');
      setOutputAudioUrl(URL.createObjectURL(await res.blob()));
    } catch (e) { console.error(e); }
    finally { setIsApplyingEffects(false); }
  }, [activeEffects, token]);

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
      await authenticatedFetch(`${API_URL}/api/voice-reference`, { method: 'POST', body: voiceForm });

      const audio = contentMode === 'voice' ? voiceBlob : contentBlob;
      let text = textInput;

      if (contentMode !== 'text' && audio) {
        setCurrentStage('translating');
        const form = new FormData();
        form.append('audio', audio, 'audio.wav');
        form.append('translate_to', translateTo || 'English');
        const res = await authenticatedFetch(`${API_URL}/api/translate`, { method: 'POST', body: form });
        if (res.status === 403) throw new Error('Access denied: User not in whitelist');
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
      const res = await authenticatedFetch(`${API_URL}/api/synthesize`, { method: 'POST', body: form });
      if (res.status === 403) throw new Error('Access denied: User not in whitelist');
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
    <div className="min-h-screen lg:h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-3 lg:p-4 flex flex-col lg:overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-1">
          <img src="./lyre_logo.png" alt="Lyre" className="w-8 h-8 lg:w-10 lg:h-10" />
          <div className="flex flex-col">
            <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent leading-tight">Lyre Studio</h1>
            <span className="text-xs text-slate-500">AI-powered voice editor.</span>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          {audioDevices.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-1.5">
              <Mic size={14} className="text-emerald-400" />
              <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)} className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer max-w-32">
                {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default Microphone'}</option>)}
              </select>
            </div>
          )}

          {/* Logout button (only if not local) */}
          {!isLocal && (
            <button onClick={logout} className="flex items-center gap-2 px-2 lg:px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700 rounded-lg text-xs text-slate-300 transition">
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 lg:gap-4 lg:min-h-0">
        {/* Left: Inputs */}
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-2 lg:overflow-y-auto">
          {/* How to Use Button */}
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-700 rounded-xl text-sm text-slate-400 hover:text-slate-200 transition"
          >
            <HelpCircle size={16} />
            <span>How to Use</span>
          </button>

          {/* Mobile mic selector */}
          {audioDevices.length > 0 && (
            <div className="sm:hidden flex items-center gap-2 bg-slate-800/60 rounded-xl px-3 py-2">
              <Mic size={14} className="text-emerald-400 shrink-0" />
              <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)} className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer flex-1 min-w-0">
                {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default Microphone'}</option>)}
              </select>
            </div>
          )}

          {/* Voice Sample */}
          <div className="bg-slate-800/60 rounded-xl p-3">
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
          <div className="bg-slate-800/60 rounded-xl p-3">
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
          <div className="bg-slate-800/60 rounded-xl p-3">
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
        <div className="flex-1 flex flex-col gap-2 min-w-0 overflow-y-auto relative pb-14">
          {/* Output area - fixed height, centered content */}
          <div className="bg-slate-800/60 rounded-xl p-4 min-h-48 lg:min-h-64 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 size={14} className="text-slate-400" />
              <span className="text-sm font-medium">Output</span>
              {isApplyingEffects && <Loader2 size={12} className="animate-spin text-purple-400" />}
              {rawAudioBlob && !isApplyingEffects && effectCount > 0 && (
                <span className="text-xs text-emerald-400/70 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              )}
            </div>

            <div className="flex-1 flex flex-col justify-center">
              {error && <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20 text-red-400 text-sm"><X size={14} className="inline mr-1" /> {error}</div>}

              {isProcessing && (
                <LoadingDisplay stage={currentStage} translatedText={translatedText} translateTo={translateTo} />
              )}

              {!isProcessing && !outputAudioUrl && currentStage === 'idle' && (
                <div className="text-center text-slate-500">
                  <p className="text-sm">Your generated audio will appear here</p>
                </div>
              )}

              {!isProcessing && outputAudioUrl && (
                <div className="space-y-3">
                  {translatedText && (
                    <div className="p-2 bg-slate-700/40 rounded-lg">
                      <span className="text-xs text-emerald-400 block mb-1">✓ {translateTo ? `Translated to ${translateTo}` : 'Transcribed'}</span>
                      <p className="text-sm text-slate-300">"{translatedText}"</p>
                    </div>
                  )}
                  <AudioPlayer url={outputAudioUrl} label="Output" />
                </div>
              )}
            </div>
          </div>

          {/* Effects section - expands downward */}
          <div className="bg-slate-800/60 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Sparkles size={14} className="text-purple-400" />
              <span className="text-sm font-medium">Effects</span>
              {effectCount > 0 && <span className="text-xs text-purple-400 bg-purple-500/20 px-1.5 rounded">{effectCount}</span>}
              <div className="flex-1" />
              {effectCount > 0 && (
                <button onClick={clearEffects} className="px-2 py-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-md flex items-center gap-1 transition">
                  <RotateCcw size={12} /> Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
              <span className="text-sm text-slate-500 shrink-0">Presets:</span>
              <div className="flex gap-1">
                {Object.entries(PRESETS).map(([id, p]) => (
                  <button key={id} onClick={() => loadPreset(id)} className="px-2 py-0.5 rounded text-xs lg:text-sm bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-300 transition whitespace-nowrap">{p.label}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
              {Object.entries(EFFECTS).map(([id, fx]) => (
                <EffectCard key={id} id={id} effect={fx} isActive={!!activeEffects[id]} params={activeEffects[id] || {}} onToggle={() => toggleEffect(id)} onParamChange={(p, v) => updateParam(id, p, v)} />
              ))}
            </div>
          </div>

          {/* Download button - bottom right on all screens */}
          {outputAudioUrl && !isProcessing && (
            <a
              href={outputAudioUrl}
              download={generateFilename()}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-white text-slate-800 rounded-lg transition text-sm font-medium shadow-lg z-10"
            >
              <Download size={14} /> Download
            </a>
          )}
        </div>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowHelp(false)}>
          <div
            className="bg-slate-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] sm:max-h-[80vh] overflow-y-auto border-t sm:border border-slate-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <HelpCircle size={20} className="text-emerald-400" />
                How to Use Lyre Studio
              </h2>
              <button onClick={() => setShowHelp(false)} className="p-1 hover:bg-slate-700 rounded-lg transition">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4 text-sm">
              <div className="space-y-2">
                <h3 className="font-medium text-cyan-400 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs">1</span>
                  Voice to Clone
                </h3>
                <p className="text-slate-400 ml-7">
                  Record or upload at least 5 seconds of audio with the voice you want to clone.
                  This should be clear speech in English with minimal background noise.
                  Longer clips (10+ seconds) produce better results. Clips over 20 seconds may be slow to load.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-emerald-400 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs">2</span>
                  Content
                </h3>
                <p className="text-slate-400 ml-7">
                  Choose what the cloned voice should say:
                </p>
                <ul className="text-slate-400 ml-7 list-disc list-inside space-y-1">
                  <li><strong>Use Voice:</strong> Speak the same words as the voice sample</li>
                  <li><strong>Record:</strong> Record different words to be spoken</li>
                  <li><strong>Type:</strong> Enter text directly</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-amber-400 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">3</span>
                  Translate (Optional)
                </h3>
                <p className="text-slate-400 ml-7">
                  Choose a target language to translate the content.
                  The cloned voice will speak in that language while preserving its characteristics.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 flex items-center justify-center text-xs text-emerald-400">4</span>
                  <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Generate</span>
                </h3>
                <p className="text-slate-400 ml-7">
                  Click the <strong>Generate</strong> button to create your cloned audio.
                  This translates and synthesizes the content in the cloned voice.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-purple-400 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-xs">5</span>
                  Effects (Optional)
                </h3>
                <p className="text-slate-400 ml-7">
                  After generating, apply audio effects like reverb, pitch shift, distortion, and more.
                  Effects are applied <strong>in real-time</strong> — adjust sliders and hear changes instantly!
                  Try the presets for quick results.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-slate-300 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-500/20 flex items-center justify-center text-xs">6</span>
                  Download
                </h3>
                <p className="text-slate-400 ml-7">
                  Once you're happy with the result, click <strong>Download</strong> to save your audio file.
                  The downloaded file includes any effects you've applied.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccessDenied() {
  const { user, logout, authError } = useAuth();

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="bg-slate-800/50 p-8 rounded-2xl border border-red-500/30 max-w-md w-full text-center space-y-6 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <X size={32} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-red-400">Access Denied</h1>
          <p className="text-slate-400">
            You're signed in as <span className="text-white">{user?.email}</span>, but this account is not authorized to use Lyre Studio.
          </p>
          {authError && (
            <p className="text-sm text-slate-500">Reason: {authError}</p>
          )}
        </div>

        <button
          onClick={logout}
          className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>

        <div className="text-xs text-slate-500">
          Contact the administrator to request access.
        </div>
      </div>
    </div>
  );
}

export default function VoiceStudio() {
  const { user, isAuthorized, isLocal } = useAuth();

  if (!user) {
    return <Login />;
  }

  // If authenticated but not authorized (and not local dev), show access denied
  if (!isAuthorized && !isLocal) {
    return <AccessDenied />;
  }

  return <VoiceStudioContent />;
}

// Main wrapper with Auth Provider
export function App() {
  return (
    <AuthProvider>
      <VoiceStudio />
    </AuthProvider>
  );
}
