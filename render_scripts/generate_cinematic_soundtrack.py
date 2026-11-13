import numpy as np
import scipy.signal as signal
from scipy.io import wavfile
import os

SAMPLE_RATE = 48000
DURATION = 60.0  # Exactly 60 seconds
TOTAL_SAMPLES = int(SAMPLE_RATE * DURATION)

# Initialize stereo buffer
audio = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float64)

t_arr = np.linspace(0, DURATION, TOTAL_SAMPLES, endpoint=False)

def add_sound(sound_mono, start_sec, pan=0.0, gain=1.0):
    start_sample = int(start_sec * SAMPLE_RATE)
    n_samples = len(sound_mono)
    if start_sample >= TOTAL_SAMPLES:
        return
    end_sample = min(start_sample + n_samples, TOTAL_SAMPLES)
    sound_len = end_sample - start_sample
    if sound_len <= 0:
        return
    
    # Pan: -1 (left) to +1 (right)
    left_gain = gain * np.cos((pan + 1) * np.pi / 4)
    right_gain = gain * np.sin((pan + 1) * np.pi / 4)
    
    audio[start_sample:end_sample, 0] += sound_mono[:sound_len] * left_gain
    audio[start_sample:end_sample, 1] += sound_mono[:sound_len] * right_gain

def make_sub_boom(duration=3.0, f_start=70.0, f_end=24.0):
    n = int(duration * SAMPLE_RATE)
    t = np.linspace(0, duration, n, endpoint=False)
    # Exponential frequency glide
    freq = f_start * (f_end / f_start) ** (t / duration)
    phase = 2 * np.pi * np.cumsum(freq) / SAMPLE_RATE
    # Envelope: punchy transient + smooth decay
    env = np.exp(-t * 2.2)
    tone = np.sin(phase) + 0.3 * np.sin(2 * phase)
    # Soft saturation
    tone = np.tanh(tone * 1.5)
    return tone * env

def make_taiko_hit(duration=1.4, f_base=95.0, punch=True):
    n = int(duration * SAMPLE_RATE)
    t = np.linspace(0, duration, n, endpoint=False)
    # Pitch drop on membrane impact
    pitch_env = np.exp(-t * 18.0)
    freq = f_base + 120.0 * pitch_env
    phase = 2 * np.pi * np.cumsum(freq) / SAMPLE_RATE
    
    body = np.sin(phase) + 0.4 * np.sin(2.1 * phase) + 0.15 * np.sin(3.8 * phase)
    # Noise transient (drum stick attack)
    noise = np.random.normal(0, 1, n) * np.exp(-t * 60.0)
    
    decay = np.exp(-t * 4.2)
    sound = (body + noise * 0.4) * decay
    return np.tanh(sound * 1.3)

def make_heartbeat(duration=0.8):
    n = int(duration * SAMPLE_RATE)
    sound = np.zeros(n)
    # Lub (0.0s) & Dub (0.16s)
    for offset, amp in [(0.0, 0.9), (0.16, 0.65)]:
        s_idx = int(offset * SAMPLE_RATE)
        t = np.linspace(0, 0.4, int(0.4 * SAMPLE_RATE), endpoint=False)
        pulse = np.sin(2 * np.pi * 48 * t) * np.exp(-t * 14.0)
        sound[s_idx:s_idx + len(pulse)] += pulse * amp
    return sound

def make_epic_impact(duration=4.5):
    boom = make_sub_boom(duration=duration, f_start=85.0, f_end=22.0)
    taiko = make_taiko_hit(duration=2.0, f_base=110.0)
    n = len(boom)
    t = np.linspace(0, duration, n, endpoint=False)
    # Crash / metallic splash tail
    noise = np.random.normal(0, 1, n)
    b, a = signal.butter(4, [1200 / (SAMPLE_RATE / 2), 12000 / (SAMPLE_RATE / 2)], btype='band')
    filtered_noise = signal.lfilter(b, a, noise) * np.exp(-t * 1.5)
    
    impact = boom * 1.0
    impact[:len(taiko)] += taiko * 0.9
    impact += filtered_noise * 0.5
    return np.tanh(impact * 1.2)

def make_riser(duration=6.0, f_start=80.0, f_end=800.0):
    n = int(duration * SAMPLE_RATE)
    t = np.linspace(0, duration, n, endpoint=False)
    freq = f_start * (f_end / f_start) ** (t / duration)
    phase = 2 * np.pi * np.cumsum(freq) / SAMPLE_RATE
    tone = np.sin(phase) + 0.25 * np.sin(2 * phase)
    # Filtered swept noise
    noise = np.random.normal(0, 1, n)
    env = (t / duration) ** 2.2
    return (tone * 0.5 + noise * 0.5) * env

def make_hihat_tick(duration=0.08):
    n = int(duration * SAMPLE_RATE)
    t = np.linspace(0, duration, n, endpoint=False)
    noise = np.random.normal(0, 1, n)
    b, a = signal.butter(3, 4000 / (SAMPLE_RATE / 2), btype='high')
    tick = signal.lfilter(b, a, noise) * np.exp(-t * 80.0)
    return tick * 0.4

print("Composing 60-Second Dramatic Cinematic Drumming Score...")

# SECTION 1: 0 - 5 SEC (Atmospheric opening & heartbeat percussion)
# Heartbeat pulses at 0.5s, 1.8s, 3.1s, 4.4s
for t_sec in [0.5, 1.8, 3.1, 4.4]:
    add_sound(make_heartbeat(), t_sec, pan=0.0, gain=0.85)

# Sub rumble under intro
sub_intro = np.sin(2 * np.pi * 38 * t_arr[:int(5.5 * SAMPLE_RATE)]) * np.linspace(0.1, 0.4, int(5.5 * SAMPLE_RATE))
add_sound(sub_intro, 0.0, pan=0.0, gain=0.6)

# SECTION 2: 5 - 12 SEC (Drumming builds with tension riser)
# Riser starting at 6.0s ending at 12.0s
add_sound(make_riser(duration=6.0, f_start=60.0, f_end=650.0), 6.0, pan=0.0, gain=0.55)

# Ticking percussion accelerating
bpm = 100
t_curr = 5.2
while t_curr < 11.8:
    step = 60.0 / bpm
    pan = -0.3 if int(t_curr * 4) % 2 == 0 else 0.3
    add_sound(make_hihat_tick(), t_curr, pan=pan, gain=0.5)
    # Tom hits on downbeats
    if int(t_curr * 2) % 2 == 0:
        add_sound(make_taiko_hit(duration=0.8, f_base=120.0), t_curr, pan=pan * 0.5, gain=0.7)
    bpm += 4.5  # Acceleration
    t_curr += step

# Pre-drop roll into 12.0s (11.2 to 11.95s)
roll_times = np.linspace(11.2, 11.95, 12)
for i, rt in enumerate(roll_times):
    vol = (i + 1) / 12.0 * 0.9
    add_sound(make_taiko_hit(duration=0.25, f_base=130 + i * 5), rt, pan=((i % 2) * 2 - 1) * 0.4, gain=vol)

# SECTION 3: 12 - 20 SEC (Massive Sutra Logo Reveal Impact!)
# Giant Impact at exactly 12.0s
add_sound(make_epic_impact(duration=5.0), 12.0, pan=0.0, gain=1.4)
# Follow-up rhythmic taiko groove at 120 BPM (0.5s per beat)
# 13.0, 14.0, 15.0, 16.0, 17.0, 18.0, 19.0, 19.5
for b_sec in [13.0, 14.0, 14.5, 15.0, 16.0, 16.75, 17.5, 18.0, 18.5, 19.0, 19.5]:
    is_downbeat = (b_sec % 1.0 == 0)
    gain = 1.0 if is_downbeat else 0.75
    f_b = 90.0 if is_downbeat else 125.0
    pan = -0.25 if (int(b_sec * 4) % 2 == 0) else 0.25
    add_sound(make_taiko_hit(duration=0.9, f_base=f_b), b_sec, pan=pan, gain=gain)
    if is_downbeat:
        add_sound(make_sub_boom(duration=1.2, f_start=65.0, f_end=32.0), b_sec, pan=0.0, gain=0.7)

# SECTION 4: 20 - 42 SEC (Relentless Rhythmic Product Showcase - 132 BPM)
# 132 BPM -> beat = 60 / 132 = 0.4545s
beat_len = 60.0 / 132.0
t_prod = 20.0
impact_points = [20.0, 25.5, 31.0, 36.5] # Major product feature cuts

for ip in impact_points:
    add_sound(make_epic_impact(duration=3.5), ip, pan=0.0, gain=1.1)

step_idx = 0
while t_prod < 42.0:
    # 4/4 driving pattern
    bar_pos = step_idx % 4
    if bar_pos == 0:
        # Kick / Heavy Taiko
        add_sound(make_taiko_hit(duration=0.8, f_base=85.0), t_prod, pan=0.0, gain=1.0)
        add_sound(make_sub_boom(duration=0.9, f_start=60.0, f_end=30.0), t_prod, pan=0.0, gain=0.8)
    elif bar_pos == 2:
        # Snare / Mid Taiko slap
        add_sound(make_taiko_hit(duration=0.6, f_base=135.0), t_prod, pan=0.1, gain=0.9)
    else:
        # Syncopated rhythm
        add_sound(make_taiko_hit(duration=0.4, f_base=115.0), t_prod, pan=-0.2, gain=0.7)
    
    # 16th note metallic pulses
    add_sound(make_hihat_tick(), t_prod, pan=-0.3, gain=0.35)
    add_sound(make_hihat_tick(), t_prod + beat_len * 0.5, pan=0.3, gain=0.4)
    
    t_prod += beat_len
    step_idx += 1

# SECTION 5: 42 - 52 SEC (Rapid Editing & Double-Time Percussion Escalation)
# 42.0 to 52.0s: Rising intensity, polyrhythmic rolls, massive energy
add_sound(make_epic_impact(duration=3.0), 42.0, pan=0.0, gain=1.2)
add_sound(make_riser(duration=9.8, f_start=100.0, f_end=950.0), 42.2, pan=0.0, gain=0.75)

t_climax = 42.5
climax_beat = beat_len / 2.0 # Double-time 264 BPM feel!
while t_climax < 51.8:
    pan = np.sin(t_climax * 8) * 0.6
    vol = 0.65 + (t_climax - 42.5) / 10.0 * 0.45
    add_sound(make_taiko_hit(duration=0.3, f_base=110.0 + (t_climax - 42.5) * 4), t_climax, pan=pan, gain=vol)
    add_sound(make_hihat_tick(), t_climax, pan=-pan, gain=0.45)
    t_climax += climax_beat

# Machine-gun fill right before final drop (51.2 - 52.0)
fill_times = np.linspace(51.2, 51.95, 16)
for i, ft in enumerate(fill_times):
    add_sound(make_taiko_hit(duration=0.15, f_base=140 + i * 4), ft, pan=((i % 2) * 2 - 1) * 0.5, gain=0.9 + i * 0.02)

# SECTION 6: 52 - 60 SEC (Colossal Climax Drop & Brand Reveal)
# 52.0s: The Grand Climax Hit!
add_sound(make_epic_impact(duration=6.5), 52.0, pan=0.0, gain=1.5)
add_sound(make_sub_boom(duration=5.0, f_start=80.0, f_end=20.0), 52.0, pan=0.0, gain=1.2)

# Resonant ringing taiko hits during the final title card:
# 54.0s ("YOUR IDEA."), 55.5s ("YOUR VISION."), 57.0s ("YOUR SUTRA.")
for st, p in [(54.0, -0.3), (55.5, 0.3), (57.0, 0.0)]:
    add_sound(make_taiko_hit(duration=2.2, f_base=85.0), st, pan=p, gain=1.1)
    add_sound(make_sub_boom(duration=2.0, f_start=60.0, f_end=25.0), st, pan=0.0, gain=0.8)

# Normalize audio to -0.3 dBFS peak
max_val = np.max(np.abs(audio))
if max_val > 0:
    audio = (audio / max_val) * 0.96

# Master fade-out over last 1.5 seconds (58.5 - 60.0)
fade_samples = int(1.5 * SAMPLE_RATE)
fade_curve = np.linspace(1.0, 0.0, fade_samples)
audio[-fade_samples:, 0] *= fade_curve
audio[-fade_samples:, 1] *= fade_curve

# Convert to 16-bit PCM
audio_int16 = (audio * 32767).astype(np.int16)

out_path = os.path.join(os.path.dirname(__file__), "../music/sutra_cinematic_percussion_60s.wav")
wavfile.write(out_path, SAMPLE_RATE, audio_int16)
print(f"[SUCCESS] Wrote studio master soundtrack to {out_path} ({DURATION}s, 48kHz Stereo)")
