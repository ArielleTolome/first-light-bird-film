#!/usr/bin/env python3
"""Verify the delivered film: python3 verify.py (requires FFmpeg)."""
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent
film = root / 'renders' / 'FIRST-LIGHT.mp4'
probe = json.loads(subprocess.check_output([
    'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(film)
]))
video = next(s for s in probe['streams'] if s['codec_type'] == 'video')
audio = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
assert (video['width'], video['height'], video['r_frame_rate']) == (1920, 1080, '30/1')
assert int(video['nb_frames']) == 1800
assert abs(float(probe['format']['duration']) - 60) < 0.01
assert audio['channels'] == 2 and audio['sample_rate'] == '48000'

def pixels(at):
    return subprocess.check_output([
        'ffmpeg', '-v', 'error', '-ss', str(at), '-i', str(film), '-frames:v', '1',
        '-vf', 'crop=1920:908:0:86,scale=96:48', '-pix_fmt', 'gray', '-f', 'rawvideo', '-'
    ])

shots = []
for i in range(8):
    t = i * 7.5 + 3.5
    a, b = pixels(t), pixels(t + 0.4)
    assert len(a) == len(b) == 96 * 48
    changed = sum(abs(x - y) > 2 for x, y in zip(a, b)) / len(a)
    assert sum(a) / len(a) > 8, f'Shot {i + 1} is black'
    assert changed > 0.01, f'Shot {i + 1} appears frozen'
    shots.append({'shot': i + 1, 'sample_seconds': t, 'changed_pixel_fraction': round(changed, 4)})
result = {'passed': True, 'duration_seconds': 60, 'resolution': [1920, 1080],
          'fps': 30, 'frames': 1800, 'stereo_audio': True, 'bytes': film.stat().st_size, 'shots': shots}
(root / 'verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
