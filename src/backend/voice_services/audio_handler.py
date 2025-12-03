import tempfile
from typing import Tuple

import numpy as np
import torchaudio


def save_upload_to_temp(upload: bytes) -> str:
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    tmp.write(upload)
    tmp.close()
    return tmp.name


def load_audio(path: str, target_sr: int = 16000) -> Tuple[np.ndarray, int]:
    waveform, sr = torchaudio.load(str(path))
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    if sr != target_sr:
        waveform = torchaudio.transforms.Resample(sr, target_sr)(waveform)
        sr = target_sr
    return waveform.squeeze(0).numpy(), sr

