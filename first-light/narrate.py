#!/usr/bin/env python3
"""Prepare narration and optional captions. Add --synthesize to regenerate the voice.
Kokoro requires kokoro-onnx + soundfile; HYPERFRAMES_PYTHON may point to that venv.
"""
import array
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import wave

ROOT = Path(__file__).resolve().parent
spec = json.loads((ROOT / 'narration.json').read_text())
RATE = 48000
frames = array.array('h', [0]) * (RATE * spec['duration'])
output_dir = ROOT / 'assets' / 'narration'
output_dir.mkdir(parents=True, exist_ok=True)
timing = []

for i, cue in enumerate(spec['cues']):
    source = output_dir / f"{cue['id']}.wav"
    if '--synthesize' in sys.argv:
        response = subprocess.check_output([
            'npx', 'hyperframes@0.8.31', 'tts', cue['text'], '--voice', spec['voice'],
            '--speed', str(spec['speed']), '--output', str(source), '--json'
        ], cwd=ROOT, text=True)
        result = json.loads(response)
        if not result.get('ok'):
            raise RuntimeError(result)
    samples = array.array('h', subprocess.check_output([
        'ffmpeg', '-v', 'error', '-i', str(source), '-ar', str(RATE), '-ac', '1',
        '-f', 's16le', '-'
    ]))
    if sys.byteorder != 'little':
        samples.byteswap()
    start = round(cue['start'] * RATE)
    end = start + len(samples)
    limit = round(spec['cues'][i + 1]['start'] * RATE) if i + 1 < len(spec['cues']) else len(frames) - RATE // 2
    assert 0 <= start < end <= limit, f"Narration {cue['id']} exceeds its slot: {end / RATE:.2f}s > {limit / RATE:.2f}s"
    frames[start:end] = samples
    timing.append({**cue, 'end': round(end / RATE, 3), 'duration': round(len(samples) / RATE, 3)})

with tempfile.TemporaryDirectory() as tmp:
    dry = Path(tmp) / 'narration.wav'
    with wave.open(str(dry), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        if sys.byteorder != 'little':
            frames.byteswap()
        wav.writeframes(frames.tobytes())
    subprocess.run([
        'ffmpeg', '-v', 'error', '-y', '-i', str(dry),
        '-af', 'loudnorm=I=-18:TP=-3:LRA=7', '-ar', str(RATE), '-ac', '1',
        str(ROOT / 'assets' / 'narration.wav')
    ], check=True)

def timestamp(seconds):
    ms = round(seconds * 1000)
    return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02}.{ms % 1000:03}'

vtt = 'WEBVTT\n\n' + '\n\n'.join(
    f"{cue['id']}\n{timestamp(cue['start'])} --> {timestamp(cue['end'])}\n{cue['text']}"
    for cue in timing
) + '\n'
(ROOT.parent / 'site' / 'assets' / 'narration-en.vtt').write_text(vtt)
(ROOT / 'narration-timing.json').write_text(json.dumps({'voice': spec['voice'], 'duration': spec['duration'], 'cues': timing}, indent=2) + '\n')
print(json.dumps(timing, indent=2))
