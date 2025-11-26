import gradio as gr
from pedalboard.io import AudioFile
import os
import shutil

def debug_audio_pipeline(temp_filepath):
    if temp_filepath is None:
        return None, "❌ No audio received. Did you grant browser mic permissions?"

    try:
        # --- CHECK 1: READ ---
        # Try to open the file Gradio created
        with AudioFile(temp_filepath) as f:
            audio_data = f.read(f.frames)
            sample_rate = f.samplerate
            channels = f.num_channels
            duration = f.duration

        # --- CHECK 2: WRITE ---
        # Save it back to disk to verify we can write files
        output_path = "saved_debug_clip.wav"
        
        # Pedalboard write logic
        with AudioFile(output_path, 'w', samplerate=sample_rate, num_channels=channels) as f:
            f.write(audio_data)

        # --- REPORT ---
        stats = (
            f"✅ Success!\n"
            f"----------------\n"
            f"Input Path: {temp_filepath}\n"
            f"Saved Path: {os.path.abspath(output_path)}\n"
            f"Channels: {channels}\n"
            f"Sample Rate: {sample_rate} Hz\n"
            f"Duration: {duration:.2f} seconds\n"
            f"Shape: {audio_data.shape}"
        )
        
        return output_path, stats

    except Exception as e:
        return None, f"❌ Error processing audio:\n{str(e)}"

# --- UI ---
demo = gr.Interface(
    fn=debug_audio_pipeline,
    inputs=gr.Audio(sources=["microphone"], type="filepath", label="Record Here"),
    outputs=[
        gr.Audio(label="Playback (From Saved File)"),
        gr.Textbox(label="Audio Stats & Debug Info")
    ],
    title="🎤 Audio Pipeline Debugger",
    description="This tool verifies that your browser, Gradio, and Pedalboard are all talking to each other correctly."
)

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)