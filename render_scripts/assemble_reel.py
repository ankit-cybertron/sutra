import os
import subprocess
import json

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS_DIR = os.path.join(ROOT_DIR, "assets")
RECORDINGS_DIR = os.path.join(ROOT_DIR, "recordings")
MUSIC_DIR = os.path.join(ROOT_DIR, "music")
OUTPUT_DIR = os.path.join(ROOT_DIR, "output")
TEMP_DIR = os.path.join(OUTPUT_DIR, "temp_segments")

os.makedirs(TEMP_DIR, exist_ok=True)

FFMPEG = "/opt/homebrew/bin/ffmpeg"

def run_cmd(cmd):
    print("RUNNING:", " ".join(cmd))
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        print("ERROR:", res.stderr)
        raise RuntimeError(f"Command failed with code {res.returncode}")
    return res.stdout

def build_segment(output_path, input_src, duration, overlay_img=None, speed=1.0, is_image=False, start_time="00:00:00", flash=False):
    # Common filter to ensure exact 1080x1920 @ 30fps
    filters = []
    
    if is_image:
        # Loop image for duration
        in_args = ["-loop", "1", "-t", str(duration), "-i", input_src]
        base_filter = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1"
        if overlay_img:
            in_args.extend(["-i", overlay_img])
            filter_str = f"[0:v]{base_filter}[bg];[bg][1:v]overlay=0:0[outv]"
        else:
            filter_str = f"[0:v]{base_filter}[outv]"
    else:
        # Video clip
        in_args = ["-ss", start_time, "-t", str(duration * speed), "-i", input_src]
        base_filter = f"setpts={1.0/speed}*PTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1"
        if overlay_img:
            in_args.extend(["-i", overlay_img])
            filter_str = f"[0:v]{base_filter}[bg];[bg][1:v]overlay=0:0[outv]"
        else:
            filter_str = f"[0:v]{base_filter}[outv]"
            
    if flash:
        # Add quick white flash over first 3 frames (0.1s)
        filter_str += ";color=c=white:s=1080x1920:d=0.1[w];[outv][w]overlay=enable='between(t,0,0.1)'[finalv]"
        v_out_map = "[finalv]"
    else:
        v_out_map = "[outv]"

    cmd = [
        FFMPEG, "-y",
        *in_args,
        "-filter_complex", filter_str,
        "-map", v_out_map,
        "-t", str(duration),
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        output_path
    ]
    run_cmd(cmd)
    print(f"[SEGMENT READY] {output_path} ({duration}s)")

def main():
    print("=== Assembling 60-Second Cinematic Reel Segments ===")
    segments = []

    # SEGMENT 01: 00.0 - 05.0s (5.0s) - Dark Cinematic Opening "EVERY GREAT IDEA..."
    seg1 = os.path.join(TEMP_DIR, "seg_01_idea.mp4")
    build_segment(seg1, os.path.join(ASSETS_DIR, "title_01_idea.png"), 5.0, is_image=True)
    segments.append(seg1)

    # SEGMENT 02: 05.0 - 08.5s (3.5s) - Rapid Interface Flash (Hero thread field & rotating words)
    seg2 = os.path.join(TEMP_DIR, "seg_02_hero_flash.mp4")
    build_segment(seg2, os.path.join(RECORDINGS_DIR, "scene1_hero.webm"), 3.5, start_time="00:00:03", speed=1.2)
    segments.append(seg2)

    # SEGMENT 03: 08.5 - 12.0s (3.5s) - Tension Riser "...DESERVES TO BECOME REALITY."
    seg3 = os.path.join(TEMP_DIR, "seg_03_reality.mp4")
    build_segment(seg3, os.path.join(ASSETS_DIR, "title_02_reality.png"), 3.5, is_image=True)
    segments.append(seg3)

    # SEGMENT 04: 12.0 - 16.0s (4.0s) - Explosive Logo Impact with Flash! "INTRODUCING SUTRA"
    seg4 = os.path.join(TEMP_DIR, "seg_04_logo_reveal.mp4")
    build_segment(seg4, os.path.join(ASSETS_DIR, "title_03_logo_reveal.png"), 4.0, is_image=True, flash=True)
    segments.append(seg4)

    # SEGMENT 05: 16.0 - 20.0s (4.0s) - Sutra Landing Showcase (Pulsing VoiceOrb & input card)
    seg5 = os.path.join(TEMP_DIR, "seg_05_landing_showcase.mp4")
    build_segment(seg5, os.path.join(RECORDINGS_DIR, "scene1_hero.webm"), 4.0, start_time="00:00:08", speed=1.0)
    segments.append(seg5)

    # SEGMENT 06: 20.0 - 26.0s (6.0s) - STAGE 01: Voice/Text Idea Intake & Refine Action
    seg6 = os.path.join(TEMP_DIR, "seg_06_idea_intake.mp4")
    build_segment(
        seg6, 
        os.path.join(RECORDINGS_DIR, "scene2_idea_input.webm"), 
        6.0, 
        overlay_img=os.path.join(ASSETS_DIR, "overlay_01_intake.png"),
        start_time="00:00:03", 
        speed=1.5
    )
    segments.append(seg6)

    # SEGMENT 07: 26.0 - 32.0s (6.0s) - STAGE 02: AI Clarification Discovery
    seg7 = os.path.join(TEMP_DIR, "seg_07_clarify.mp4")
    build_segment(
        seg7, 
        os.path.join(RECORDINGS_DIR, "scene3_clarification.webm"), 
        6.0, 
        overlay_img=os.path.join(ASSETS_DIR, "overlay_02_clarify.png"),
        start_time="00:00:01", 
        speed=1.4
    )
    segments.append(seg7)

    # SEGMENT 08: 32.0 - 37.0s (5.0s) - STAGE 03: Dynamic 10-Factor Readiness Score Audit
    seg8 = os.path.join(TEMP_DIR, "seg_08_readiness.mp4")
    build_segment(
        seg8, 
        os.path.join(RECORDINGS_DIR, "scene4_readiness_modal.webm"), 
        5.0, 
        overlay_img=os.path.join(ASSETS_DIR, "overlay_03_readiness.png"),
        start_time="00:00:00", 
        speed=1.0
    )
    segments.append(seg8)

    # SEGMENT 09: 37.0 - 43.0s (6.0s) - STAGE 04: Interactive React Flow Architecture
    seg9 = os.path.join(TEMP_DIR, "seg_09_arch.mp4")
    build_segment(
        seg9, 
        os.path.join(RECORDINGS_DIR, "scene5_reactflow_arch.webm"), 
        6.0, 
        overlay_img=os.path.join(ASSETS_DIR, "overlay_04_arch.png"),
        start_time="00:00:02", 
        speed=1.0
    )
    segments.append(seg9)

    # SEGMENT 10: 43.0 - 48.0s (5.0s) - STAGE 05: Plan Co-Pilot Live Chat & Mutations
    seg10 = os.path.join(TEMP_DIR, "seg_10_copilot.mp4")
    build_segment(
        seg10, 
        os.path.join(RECORDINGS_DIR, "scene6_copilot_chat.webm"), 
        5.0, 
        overlay_img=os.path.join(ASSETS_DIR, "overlay_05_copilot.png"),
        start_time="00:00:00", 
        speed=1.0
    )
    segments.append(seg10)

    # SEGMENT 11: 48.0 - 52.0s (4.0s) - Rapid Montage Crescendo (0.8s cuts)
    seg11 = os.path.join(TEMP_DIR, "seg_11_montage.mp4")
    # Montage cut of blueprint, architecture, must-haves, prompt block
    montage_parts = [
        {"src": os.path.join(ASSETS_DIR, "step_42_shot_1_step_38_readiness_score.png"), "d": 0.8, "is_img": True},
        {"src": os.path.join(ASSETS_DIR, "step_46_shot_1_step_40_architecture_diagram.png"), "d": 0.8, "is_img": True},
        {"src": os.path.join(ASSETS_DIR, "step_48_shot_1_step_41_architecture_node_detail.png"), "d": 0.8, "is_img": True},
        {"src": os.path.join(ASSETS_DIR, "step_52_shot_1_step_43_copilot_response.png"), "d": 0.8, "is_img": True},
        {"src": os.path.join(ASSETS_DIR, "step_56_shot_1_step_44_must_haves_v2.png"), "d": 0.8, "is_img": True},
    ]
    m_files = []
    for idx, mp in enumerate(montage_parts):
        mp_out = os.path.join(TEMP_DIR, f"seg_11_sub_{idx}.mp4")
        build_segment(mp_out, mp["src"], mp["d"], is_image=mp["is_img"])
        m_files.append(mp_out)
    
    # Concat montage parts into seg11
    m_list_file = os.path.join(TEMP_DIR, "montage_list.txt")
    with open(m_list_file, "w") as f:
        for mf in m_files:
            f.write(f"file '{mf}'\n")
    run_cmd([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", m_list_file, "-c", "copy", seg11])
    segments.append(seg11)

    # SEGMENT 12: 52.0 - 60.0s (8.0s) - Massive Climax & Final Brand Reveal
    seg12 = os.path.join(TEMP_DIR, "seg_12_brand_reveal.mp4")
    build_segment(seg12, os.path.join(ASSETS_DIR, "title_06_final_brand.png"), 8.0, is_image=True, flash=True)
    segments.append(seg12)

    # Concatenate all 12 video segments
    concat_list = os.path.join(TEMP_DIR, "concat_list.txt")
    with open(concat_list, "w") as f:
        for s in segments:
            f.write(f"file '{s}'\n")

    video_concat_raw = os.path.join(TEMP_DIR, "video_concat_raw.mp4")
    run_cmd([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat_list, "-c", "copy", video_concat_raw])

    # Final Mux with the 60.0s Soundtrack!
    audio_src = os.path.join(MUSIC_DIR, "sutra_cinematic_percussion_60s.wav")
    final_output = os.path.join(OUTPUT_DIR, "Sutra_Launch_Reel_60s.mp4")
    preview_output = os.path.join(OUTPUT_DIR, "Sutra_Launch_Reel_Preview.mp4")

    print("=== Final Mastering: Muxing Video & 48kHz Stereo Audio ===")
    run_cmd([
        FFMPEG, "-y",
        "-i", video_concat_raw,
        "-i", audio_src,
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", "19",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "320k",
        "-ar", "48000",
        "-shortest",
        final_output
    ])
    print(f"[MASTER COMPLETE] {final_output}")

    # Generate preview version (compact 720x1280 for instant sharing)
    print("=== Generating Preview MP4 ===")
    run_cmd([
        FFMPEG, "-y",
        "-i", final_output,
        "-vf", "scale=720:1280",
        "-c:v", "libx264",
        "-preset", "faster",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "192k",
        preview_output
    ])
    print(f"[PREVIEW COMPLETE] {preview_output}")

    print("=== ALL REEL DELIVERABLES MASTERED TO PERFECTION! ===")

if __name__ == "__main__":
    main()
