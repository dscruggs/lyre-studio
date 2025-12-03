import gradio as gr
import torch

_original_torch_load = torch.load
def _patched_torch_load(*args, **kwargs):
    if 'map_location' not in kwargs:
        device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        kwargs['map_location'] = device
    return _original_torch_load(*args, **kwargs)
torch.load = _patched_torch_load

import torchaudio
from pathlib import Path
from transformers import AutoProcessor, SeamlessM4Tv2ForSpeechToText
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

# --- CONFIGURATION ---
# SeamlessM4T language codes (only languages Chatterbox supports)
LANG_MAP = {
    "Arabic": "arb",
    "Chinese": "cmn",
    "Danish": "dan",
    "Dutch": "nld",
    "Finnish": "fin",
    "French": "fra",
    "German": "deu",
    "Greek": "ell",
    "Hebrew": "heb",
    "Hindi": "hin",
    "Italian": "ita",
    "Japanese": "jpn",
    "Korean": "kor",
    "Malay": "zlm",
    "Norwegian": "nob",
    "Polish": "pol",
    "Portuguese": "por",
    "Russian": "rus",
    "Spanish": "spa",
    "Swahili": "swh",
    "Swedish": "swe",
    "Turkish": "tur",
}

# Chatterbox uses ISO 639-1 codes
CHATTERBOX_LANG_MAP = {
    "Arabic": "ar",
    "Chinese": "zh",
    "Danish": "da",
    "Dutch": "nl",
    "Finnish": "fi",
    "French": "fr",
    "German": "de",
    "Greek": "el",
    "Hebrew": "he",
    "Hindi": "hi",
    "Italian": "it",
    "Japanese": "ja",
    "Korean": "ko",
    "Malay": "ms",
    "Norwegian": "no",
    "Polish": "pl",
    "Portuguese": "pt",
    "Russian": "ru",
    "Spanish": "es",
    "Swahili": "sw",
    "Swedish": "sv",
    "Turkish": "tr",
}

DEVICE = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
OUTPUT_DIR = Path("outputs")
OUTPUT_DIR.mkdir(exist_ok=True)

print(f"⚙️  Loading models to {DEVICE}...")

# 1. Load SeamlessM4Tv2 for Speech-to-Text ONLY (saves VRAM!)
# Using task-specific class skips vocoder/T2U components
print("Loading SeamlessM4Tv2-Large (Speech-to-Text only)...")
seamless_processor = AutoProcessor.from_pretrained("facebook/seamless-m4t-v2-large")
seamless_model = SeamlessM4Tv2ForSpeechToText.from_pretrained(
    "facebook/seamless-m4t-v2-large",
    dtype=torch.float16,  # v2 has better fp16 support!
).to(DEVICE)

# 2. Load Chatterbox Multilingual
print("Loading Chatterbox Multilingual...")
chatterbox = ChatterboxMultilingualTTS.from_pretrained(device=DEVICE)

# Fix: SDPA doesn't support output_attentions, which Chatterbox needs for alignment
# Set the underlying transformer to use eager attention
chatterbox.t3.tfmr.config._attn_implementation = "eager"

print("✅ All models loaded!")
print("   - SeamlessM4Tv2-Large (S2T only, fp16): ~3-4GB")
print("   - Chatterbox Multilingual: ~2-3GB")
print(f"SeamlessM4T device: {next(seamless_model.parameters()).device}")
print(f"Chatterbox device: {next(chatterbox.t3.parameters()).device}")
print("   - Total: ~5-7GB")


def load_audio_for_seamless(audio_path: str, target_sr: int = 16000):
    """Load and resample audio for SeamlessM4T (requires 16kHz)."""
    waveform, sr = torchaudio.load(audio_path)
    
    # Convert to mono if stereo
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    
    # Resample to 16kHz if needed
    if sr != target_sr:
        resampler = torchaudio.transforms.Resample(sr, target_sr)
        waveform = resampler(waveform)
    
    return waveform.squeeze(0).numpy(), target_sr


def process_audio(audio_filepath, target_lang_name, exaggeration, cfg_weight):
    """
    Pipeline:
    1. SeamlessM4Tv2: English speech -> Translated text
    2. Chatterbox: Translated text + voice reference -> Cloned speech
    """
    if audio_filepath is None:
        return "Please record audio first.", None

    seamless_lang = LANG_MAP.get(target_lang_name)
    cb_lang = CHATTERBOX_LANG_MAP.get(target_lang_name)
    if not seamless_lang or not cb_lang:
        return f"Language '{target_lang_name}' not supported.", None

    # --- STAGE 1: SPEECH-TO-TEXT TRANSLATION with SeamlessM4Tv2 ---
    print(f"Stage 1: Translating speech to {target_lang_name} text...")
    
    audio_array, sr = load_audio_for_seamless(audio_filepath)
    
    inputs = seamless_processor(
        audio=audio_array,
        sampling_rate=sr,
        return_tensors="pt",
    ).to(DEVICE)
    
    with torch.no_grad():
        text_output = seamless_model.generate(
            **inputs,
            tgt_lang=seamless_lang,
        )
    
    translated_text = seamless_processor.decode(
        text_output[0].squeeze().tolist(),
        skip_special_tokens=True
    )
    print(f"  Translated: {translated_text}")

    if not translated_text.strip():
        return "Could not translate audio. Please try again.", None

    # --- STAGE 2: VOICE CLONING with Chatterbox ---
    print("Stage 2: Synthesizing with your voice...")
    
    wav = chatterbox.generate(
        translated_text,
        audio_prompt_path=audio_filepath,
        language_id=cb_lang,
        exaggeration=exaggeration,
        cfg_weight=cfg_weight,
    )
    
    output_path = OUTPUT_DIR / "output_cloned.wav"
    torchaudio.save(str(output_path), wav, chatterbox.sr)

    print("✅ Done!")
    return f"**{target_lang_name}:** {translated_text}", str(output_path)


# --- UI ---
demo = gr.Interface(
    fn=process_audio,
    inputs=[
        gr.Audio(sources=["microphone", "upload"], type="filepath", 
                 label="Your Voice in English (will be cloned)"),
        gr.Dropdown(
            choices=list(LANG_MAP.keys()),
            value="Spanish",
            label="Target Language"
        ),
        gr.Slider(0.0, 1.0, value=0.5, label="Emotion Exaggeration", 
                  info="0=monotone, 1=dramatic"),
        gr.Slider(0.0, 1.0, value=0.5, label="Style Weight (CFG)", 
                  info="Lower=faster pace, Higher=closer to reference"),
    ],
    outputs=[
        gr.Textbox(label="Translation"),
        gr.Audio(label="Your Voice Speaking the Translation")
    ],
    title="🎙️ Voice-Preserving Translator",
    description="""
    **Optimized for 8GB VRAM**
    
    1. **SeamlessM4Tv2-Large** (S2T only) - Translates English speech to target language text
    2. **Chatterbox Multilingual** - Speaks the translation in YOUR cloned voice
    
    Speak into the mic in English → Get your cloned voice in the target language!
    """,
)

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)