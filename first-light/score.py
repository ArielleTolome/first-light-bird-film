#!/usr/bin/env python3
"""FIRST LIGHT — original 16-bar miniature in D, 64 BPM. Run with Python + NumPy."""
from pathlib import Path
import wave
import numpy as np

RATE = 48_000
DURATION = 60
FRAMES = RATE * DURATION
BEAT = 0.9375
BAR = 4 * BEAT
rng = np.random.default_rng(60419)
music = np.zeros((FRAMES, 2), dtype=np.float64)
foley = np.zeros_like(music)
TAU = 2 * np.pi


def timeline(duration):
    return np.arange(round(duration * RATE)) / RATE


def envelope(t, attack=0.1, release=0.5):
    return np.sin(np.minimum(t / attack, 1) * np.pi / 2) ** 2 * np.sin(
        np.clip((len(t) / RATE - t) / release, 0, 1) * np.pi / 2
    ) ** 2


def frequency(note):
    return 440 * 2 ** ((note - 69) / 12)


def noise(duration, low, high):
    n = round(duration * RATE)
    bins = np.fft.rfftfreq(n, 1 / RATE)
    spectrum = np.fft.rfft(rng.normal(size=n))
    # Smooth filters keep noise soft and avoid sharp-band ringing.
    spectrum *= (1 - np.exp(-(bins / low) ** 4)) / (1 + (bins / high) ** 6)
    result = np.fft.irfft(spectrum, n)
    return result / max(np.std(result), 1e-9)


def place(signal, start, gain, pan=0, bus=music):
    offset = round(start * RATE)
    count = min(len(signal), FRAMES - offset)
    if count <= 0:
        return
    angle = (pan + 1) * np.pi / 4
    bus[offset:offset + count, 0] += signal[:count] * gain * np.cos(angle)
    bus[offset:offset + count, 1] += signal[:count] * gain * np.sin(angle)


def piano(note, start, gain=0.12, pan=-0.15, length=3.7, bell=False):
    t = timeline(length)
    f = frequency(note)
    signal = np.zeros_like(t)
    # Inharmonic decaying partials and beating strings, with a felt-soft hammer.
    for partial in range(1, 9):
        ratio = partial * np.sqrt(1 + 0.00011 * partial * partial)
        decay = (2.6 if bell else 1.9) / (1 + partial * 0.27)
        weight = (0.69 ** (partial - 1)) / partial ** 0.38
        if bell and partial in (3, 6):
            weight *= 1.55
        for cents, balance in ((-1.9, 0.5), (2.1, 0.5)):
            signal += balance * weight * np.sin(TAU * f * ratio * 2 ** (cents / 1200) * t) * np.exp(-t / decay)
    signal += noise(length, 650, 2400) * np.exp(-t / 0.018) * 0.025
    signal *= envelope(t, 0.012 if bell else 0.022, 0.6)
    place(signal, start, gain, pan)


def strings(note, start, length, gain, pan, bright=0.65):
    t = timeline(length)
    f = frequency(note)
    signal = np.zeros_like(t)
    # Independent bowed voices: unequal tuning, slow drift and delayed vibrato.
    for voice, cents in enumerate((-8.2, -3.1, 3.5, 8.8)):
        phase = rng.uniform(0, TAU)
        drift = 0.0020 * np.sin(TAU * (0.31 + voice * 0.041) * t + phase)
        vibrato = 0.0028 * np.minimum(t / 1.2, 1) * np.sin(TAU * (4.7 + voice * 0.16) * t + phase)
        base = TAU * f * 2 ** (cents / 1200) * (t + (drift + vibrato) / TAU)
        for harmonic in range(1, 8):
            signal += np.sin(harmonic * base + phase) * np.exp(-harmonic / (2.2 + bright)) / harmonic / 4
    signal += noise(length, 250, 2300) * 0.018
    signal *= envelope(t, min(1.0, length / 4), min(1.35, length / 3))
    signal *= 0.83 + 0.17 * np.sin(np.pi * t / length) ** 2
    place(signal, start, gain, pan)


def flute(note, start, length, gain=0.105, pan=0.2):
    t = timeline(length)
    f = frequency(note)
    vibrato = 0.005 * np.sin(TAU * 5.1 * t) * np.minimum(t / 0.5, 1)
    phase = TAU * f * t + vibrato * f / 5.1
    tone = np.sin(phase) + 0.23 * np.sin(2 * phase) + 0.07 * np.sin(3 * phase)
    tone += noise(length, 900, 4300) * (0.065 + 0.03 * np.sin(TAU * 1.7 * t))
    tone *= envelope(t, 0.13, 0.24) * (0.94 + 0.06 * np.sin(TAU * 0.7 * t))
    place(tone, start, gain, pan)


def bass(note, start, length, gain):
    t = timeline(length)
    phase = TAU * frequency(note) * t
    tone = np.sin(phase) + 0.3 * np.sin(phase * 2) + 0.12 * np.sin(phase * 3)
    place(tone * envelope(t, 0.2, 0.85) * np.exp(-t / 6), start, gain, -0.02)


def pulse(start, gain, light=False):
    length = 0.32 if light else 0.8
    t = timeline(length)
    if light:
        tone = noise(length, 1800, 6500) * np.exp(-t / 0.04)
    else:
        phase = TAU * (62 * t + 42 * 0.04 * (1 - np.exp(-t / 0.04)))
        tone = np.sin(phase) * np.exp(-t / 0.19)
        tone += noise(length, 180, 700) * 0.19 * np.exp(-t / 0.065)
    place(tone * envelope(t, 0.007, 0.09), start, gain, 0.32 if light else 0)


# Two bars per image: dawn, flight, river, lagoon, storm, release, flock, home.
# Bass note followed by close string voicing; extensions preserve an open sky.
harmony = [
    (38, [57, 61, 64, 66]),       # Dmaj9
    (35, [57, 59, 62, 66]),       # Bm7
    (31, [54, 57, 59, 62]),       # Gmaj9
    (33, [56, 59, 61, 64]),       # Aadd9
    (30, [57, 61, 62, 66]),       # D/F#
    (31, [54, 57, 59, 62]),       # Gmaj9
    (40, [55, 59, 62, 66]),       # Em9, lagoon
    (33, [54, 57, 59, 61]),       # A6/9
    (35, [54, 59, 61, 62]),       # Bm(add9), shadow
    (33, [55, 58, 61, 64]),       # A7(b9), storm tension
    (38, [57, 61, 64, 66]),       # Dmaj9, sun breaks through
    (31, [54, 57, 59, 62]),       # Gmaj9
    (35, [57, 59, 62, 66]),       # Bm7, broad flight
    (33, [55, 57, 61, 64]),       # A7, returning home
    (38, [54, 57, 61, 64]),       # Dmaj9, final repose
    (38, [54, 57, 61, 64]),
]
energy = [0.54, 0.59, 0.75, 0.77, 0.83, 0.82, 0.65, 0.69, 0.71, 0.9, 1.0, 0.92, 1.12, 1.15, 0.69, 0.43]
for bar, (root, chord) in enumerate(harmony):
    start = bar * BAR
    level = energy[bar]
    if bar == 15:
        continue  # Last chord is held, not re-attacked.
    duration = 8.0 if bar == 14 else 4.75
    for voice, note in enumerate(chord):
        strings(note, start, duration, 0.12 * level, -0.72 + voice * 0.48, level)
    bass(root, start, duration, 0.14 * level)
    if 10 <= bar <= 13:
        strings(chord[-1] + 12, start + 0.1, 4.6, 0.052 * level, 0.58, 1.1)
    if bar == 14:
        for j, note in enumerate((62, 69, 73, 78, 81)):
            piano(note, start + 0.12 + j * 0.13, 0.095, -0.35 + j * 0.16, length=6.8)
        continue
    step = BEAT if bar < 2 or bar >= 8 and bar < 10 else BEAT / 2
    pattern = [0, 2, 1, 3, 2, 1, 3, 2]
    for j, when in enumerate(np.arange(0, BAR, step)):
        note = chord[pattern[j % 8]] + 12
        if bar in (8, 9):
            note -= 12
        piano(note, start + when + 0.025 * np.sin(j * 1.7),
              0.085 * level * (1 if j % 2 == 0 else 0.72),
              -0.28 + 0.22 * np.sin(j * 1.3), bell=bar in (6, 7))
    if 2 <= bar <= 13:
        for beat in (0, 2):
            pulse(start + beat * BEAT, 0.056 * level)
        if bar in (4, 5, 6, 7, 12, 13):
            for j in range(8):
                pulse(start + j * BEAT / 2, 0.017 * level, light=True)

# A recurring D–F#–A–E gesture changes register and orchestration with the journey.
phrases = [
    (0.95, [74, 78, 81, 76], [1, 1, 1.5, 2], 0.066),
    (8.0, [74, 78, 81, 83, 81, 76], [1, 1, 1, 1, 1, 1.6], 0.094),
    (15.5, [78, 81, 85, 83, 81, 78], [1, 1, 1.5, 0.5, 1, 1.6], 0.10),
    (23.0, [78, 79, 83, 81, 78, 76], [0.75, 0.75, 1.5, 1, 1, 1.5], 0.082),
    (30.5, [74, 73, 71, 70], [1.5, 1.5, 1.5, 2], 0.076),
    (37.65, [78, 81, 86, 85, 81, 78], [1, 1, 1.5, 0.5, 1, 1.7], 0.115),
    (45.1, [81, 83, 86, 85, 81, 76], [1, 1, 1.5, 0.5, 1, 1.9], 0.12),
    (53.0, [78, 76, 74], [1, 1, 2.8], 0.076),
]
for start, notes, beats, gain in phrases:
    for note, count in zip(notes, beats):
        length = count * BEAT
        flute(note, start, length + 0.16, gain)
        if start < 7.5 or start >= 53:
            piano(note - 12, start + 0.025, gain * 0.72, -0.36)
        start += length

# Original location sound: colored-noise beds, ripples, air and small bird phrases.
for pan in (-0.8, 0.8):
    t = timeline(15.8)
    water = noise(15.8, 230, 2400)
    water *= 0.65 + 0.18 * np.sin(TAU * 0.36 * t + pan * 2) + 0.12 * np.sin(TAU * 1.7 * t)
    place(water * envelope(t, 1.1, 1.3), 14.6, 0.018, pan, foley)
for j in range(28):
    start = 15.5 + j * 0.5
    t = timeline(0.22)
    f = 670 + (j * 137) % 550
    droplet = np.sin(TAU * (f * t + 150 * t * t)) * np.exp(-t / 0.032)
    place(droplet * envelope(t, 0.004, 0.06), start, 0.006, np.sin(j * 2.3) * 0.8, foley)
for j in range(5):
    t = timeline(0.52)
    whoosh = noise(0.52, 220, 2300) * np.sin(np.pi * t / 0.52) ** 2
    place(whoosh, 7.3 + j * 0.32, 0.034 * (1 - j * 0.09), -0.55 + j * 0.22, foley)
for pan in (-0.75, 0.75):
    t = timeline(9.4)
    wind = noise(9.4, 55, 620) * (0.55 + 0.28 * np.sin(TAU * 0.31 * t + pan))
    rain = noise(9.4, 1700, 6100) * (0.55 + 0.18 * np.sin(TAU * 0.8 * t))
    swell = envelope(t, 2.3, 2.0)
    place((wind * 0.065 + rain * 0.026) * swell, 28.5, 1, pan, foley)
# Soft timpani-like thunder underneath the storm, never a jump-scare.
for start, gain in ((31.7, 0.073), (35.0, 0.095)):
    t = timeline(2.6)
    thunder = noise(2.6, 25, 170) * envelope(t, 0.3, 1.6) * np.exp(-t / 1.3)
    place(thunder, start, gain, -0.15, foley)
for start, pan, transpose in ((0.7, -0.6, 0), (2.45, 0.65, 280), (5.1, -0.35, -160),
                              (54.3, 0.6, 80), (56.2, -0.5, -110), (57.3, 0.2, 140)):
    for chirp in range(3):
        length = 0.13 + chirp * 0.025
        t = timeline(length)
        f = 2250 + transpose + 950 * np.sin(np.pi * t / length) + 180 * np.sin(TAU * 28 * t)
        phase = TAU * np.cumsum(f) / RATE
        song = (np.sin(phase) + 0.12 * np.sin(2 * phase)) * np.sin(np.pi * t / length) ** 2
        place(song, start + chirp * 0.19, 0.025 - chirp * 0.003, pan, foley)


def reverberate(source):
    """Damped, stereo-different hall impulse, including early reflections."""
    tail = 3.6
    n = round(tail * RATE)
    t = np.arange(n) / RATE
    result = np.zeros_like(source)
    fft_size = 1 << (FRAMES + n - 2).bit_length()
    for channel in range(2):
        impulse = noise(tail, 100, 3800) * np.exp(-t / 0.65) * 0.0016
        impulse[:round(0.045 * RATE)] = 0
        for delay, gain in ((0.061, 0.22), (0.097, 0.15), (0.151, 0.11), (0.227, 0.075)):
            impulse[round((delay + channel * 0.013) * RATE)] += gain
        feed = source[:, channel] * 0.84 + source[:, 1 - channel] * 0.16
        result[:, channel] = np.fft.irfft(np.fft.rfft(feed, fft_size) * np.fft.rfft(impulse, fft_size), fft_size)[:FRAMES]
    return result


# Keep the foley close, with a little of the same space as the orchestra.
master = music + reverberate(music) * 0.63 + foley
master -= np.mean(master, axis=0)
master *= np.minimum(np.arange(FRAMES) / (0.65 * RATE), 1)[:, None]
fade = round(1.8 * RATE)
master[-fade:] *= np.cos(np.linspace(0, np.pi / 2, fade))[:, None] ** 2
# Gentle analog-like rounding and headroom; retain the natural scene dynamics.
master = np.tanh(master * 1.15)
rms = float(np.sqrt(np.mean(master ** 2)))
peak = float(np.max(np.abs(master)))
master *= min(0.14 / max(rms, 1e-9), 0.86 / max(peak, 1e-9))
# TPDF dither is seeded with the composition; digital silence at the last sample.
dither = (rng.random(master.shape) - rng.random(master.shape)) / 65536
pcm = np.rint(np.clip(master + dither, -1, 1) * 32767).astype('<i2')
pcm[-1] = 0
output = Path(__file__).resolve().parent / 'assets' / 'score.wav'
output.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(output), 'wb') as wav:
    wav.setnchannels(2)
    wav.setsampwidth(2)
    wav.setframerate(RATE)
    wav.writeframes(pcm.tobytes())
print(f'Composed {output}: 60 seconds, stereo PCM16, 48000 Hz; original 16-bar D-major score.')
