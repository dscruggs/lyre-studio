import gradio as gr
import torch
from transformers import AutoProcessor, SeamlessM4Tv2Model
from pedalboard.io import AudioFile

# --- CONFIGURATION ---
# Common languages supported by SeamlessM4T
# You can add more codes (e.g., 'cmn' for Chinese, 'rus' for Russian)
LANG_MAP = {
    "English": "eng",
    "French": "fra",
    "German": "deu",
    "Spanish": "spa",
    "Italian": "ita",
    "Portuguese": "por",
    "Hindi": "hin",
    "Japanese": "jpn"
}

DEVICE = "cuda:0" if torch.cuda.is_available() else "cpu"

print(f"⚙️  Loading model to {DEVICE}...")

# 1. Load Processor
processor = AutoProcessor.from_pretrained("facebook/seamless-m4t-v2-large")

# 2. Load Model
# FIX: Changed 'torch_dtype' to 'dtype' to silence the warning
model = SeamlessM4Tv2Model.from_pretrained(
    "facebook/seamless-m4t-v2-large",
    dtype=torch.float16
).to(DEVICE)

print("✅ Model Loaded.")

def process_audio(audio_filepath, target_lang_name, generate_audio_flag):
    if audio_filepath is None:
        return "Please record audio first.", None

    tgt_lang_code = LANG_MAP.get(target_lang_name, "eng")

    # --- 1. READ (using Pedalboard) ---
    try:
        with AudioFile(audio_filepath).resampled_to(16000) as f:
            audio_array = f.read(f.frames)
            # Ensure 1D array (samples,)
            if audio_array.ndim > 1:
                audio_array = audio_array[0]
    except Exception as e:
        return f"Error reading audio: {e}", None

    inputs = processor(audio=audio_array, return_tensors="pt", sampling_rate=16000)
    inputs = {k: v.to(DEVICE) for k, v in inputs.items()}

    # --- 2. INFERENCE ---
    with torch.no_grad():
        # Always get text first
        text_output = model.generate(
            **inputs,
            tgt_lang=tgt_lang_code,
            generate_speech=False,
        )
        text_tokens = text_output.sequences[0].tolist()
        translated_text = processor.decode(text_tokens, skip_special_tokens=True)

        # Optionally generate speech (requires second inference)
        output_audio_path = None
        if generate_audio_flag:
            waveform, waveform_length = model.generate(
                **inputs,
                tgt_lang=tgt_lang_code,
                generate_speech=True,
            )
            
            audio_data = waveform.cpu().numpy().squeeze()
            output_audio_path = "output_speech.wav"
            with AudioFile(output_audio_path, 'w', samplerate=16000, num_channels=1) as f:
                f.write(audio_data.reshape(1, -1).astype("float32"))

    return translated_text, output_audio_path
# --- UI SETUP ---
demo = gr.Interface(
    fn=process_audio,
    inputs=[
        gr.Audio(sources=["microphone"], type="filepath", label="Your Voice"),
        gr.Dropdown(choices=list(LANG_MAP.keys()), value="English", label="Target Language"),
        gr.Checkbox(label="Generate Speech Output?", value=False)
    ],
    outputs=[
        gr.Textbox(label="Translation"),
        gr.Audio(label="Synthesized Speech")
    ],
    title="Universal Translator (SeamlessM4T)",
    description="Speak into the mic, choose a language, and the AI will translate (and speak) it back."
)

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)