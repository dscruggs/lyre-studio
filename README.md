# Lyre Studio

<img src="src/frontend/public/lyre_studio.png" alt="Lyre Studio UI Screenshot" height=200px>


A fully local voice cloning and translation tool. Record or upload a voice sample, then generate new speech in that voice - in any supported language, with optional audio effects. All processing happens locally - no audio is sent to external servers. Works much better with GPU (translation and voice style transfer runs in 10-20 seconds vs minutes w/ CPU)

## What It Does

1. **Voice Upload** - Capture your own or someone else's voice from a ~5-10+ second audio clip
2. **Content Selection** - Choose what the cloned voice should say:
   - Use the original clip's speech
   - Record or upload different audio
   - Type text directly
3. **Audio style transfer** - Outputs the content of step 2 in the voice of step 1
3. **Translation** - Optionally translate the content into 20+ languages
4. **Effects** - Apply realtime studio effects like pitch shift, reverb, distortion, and more. Presets are included to get started.

The output is synthesized speech that sounds like the original voice sample, speaking your chosen content in your target language. This final clip can then be downloaded for use.

## Example Use Cases

- Translate a voice memo into another language while preserving the speaker's voice
- Create voiceovers in your own voice without re-recording
- Create clips of celebrities saying original content
- Create funny effects with the clips you create

## Quick Start

Native setup is recommended for GPU acceleration (CUDA on Linux/Windows, MPS on Mac).

First time setup will take a while as models have to install from Huggingface.

### Prerequisites

| Tool | Install | Verify |
|------|---------|--------|
| Python 3.13+ | [python.org](https://www.python.org/downloads/) | `python3 --version` |
| uv | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | `uv --version` |
| FFmpeg | macOS: `brew install ffmpeg` / Linux: `apt-get install ffmpeg` | `ffmpeg -version` |
| Bun | `curl -fsSL https://bun.sh/install \| bash` | `bun --version` |

On macOS you may need `export DYLD_LIBRARY_PATH="/opt/homebrew/opt/ffmpeg/lib"` if FFmpeg libraries are not found.

May work with older versions of Python, 3.13 is the only one tested.

### Running

```bash
# Terminal 1: Start backend
./scripts/start-backend.sh

# Terminal 2: Start frontend
./scripts/start-frontend.sh
```

Open http://localhost:5173 to use Lyre Studio.

## Docker Setup (Alternative)

Docker is available but has GPU limitations:
- **Linux + NVIDIA GPU**: Works with nvidia-container-toolkit installed
- **Mac (Apple Silicon)**: No MPS support in Docker - runs on CPU only
- **Windows + NVIDIA**: Works with WSL2 + nvidia-container-toolkit

```bash
docker compose up --build
```

- Backend API: http://localhost:8000
- Frontend UI: http://localhost:5173

Models download on first run and are cached in a Docker volume.

For NVIDIA GPU support, ensure [nvidia-container-toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) is installed. The compose file includes GPU configuration.

## Repository Layout

```
src/backend/
  main.py                 # FastAPI entrypoint
  api/                    # Routes, state, schemas, config loader
  voice_services/         # Translation, synthesis, effects processing
  config/                 # YAML configs (languages, effects)

src/frontend/             # Vite + React app (Bun-based dev workflow)

Dockerfile.backend        # UV + FFmpeg backend image
Dockerfile.frontend       # Bun dev server image
docker-compose.yml        # Full stack orchestration
```

## Models Used

Lyre Studio uses two open-source models from Hugging Face:

| Model | Purpose | Size |
|-------|---------|------|
| [SeamlessM4T v2 Large](https://huggingface.co/facebook/seamless-m4t-v2-large) | Speech-to-text translation across 100+ languages | ~9GB |
| [Chatterbox TTS](https://huggingface.co/ResembleAI/chatterbox) | Zero-shot voice cloning and multilingual text-to-speech | ~1GB |

Audio effects (reverb, distortion, pitch shift, etc.) are powered by [Pedalboard](https://github.com/spotify/pedalboard), Spotify's open-source audio processing library.

## Troubleshooting

Tested on up to 30s audio clips. Longer clips may run into memory issues and will take longer to run but otherwise should be ok.

| Issue | Fix |
|-------|-----|
| Models keep downloading | Delete `~/.cache/huggingface` if corrupted, ensure steady internet. |
| ffmpeg not found | Install FFmpeg and confirm it's on PATH. macOS may require DYLD_LIBRARY_PATH. |
| Bun command missing | Re-run the installer or add `~/.bun/bin` to your shell PATH. |
| Ports 8000/5173 busy | Kill the process using the port or specify a different port. |
| Slow generation | First request warms models; GPU acceleration (CUDA or MPS) speeds up subsequent calls. |
| Docker running on CPU | Mac cannot use MPS in Docker. Linux needs nvidia-container-toolkit for GPU. |

## System Requirements

- RAM: 8GB minimum, 16GB+ recommended
- Storage: ~10GB for models and dependencies
- GPU: Recommended (NVIDIA CUDA or Apple Silicon MPS) with 8GB+ VRAM
- Internet: Required for initial model downloads
