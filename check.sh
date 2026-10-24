#!/bin/bash
# Post-render checks: loop seam, determinism, brand orange in the encoded video, the phone test.
set -e
cd "$(dirname "$0")"
MP4=${1:-out/film-en-9x16.mp4}
echo "== $MP4"; ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,color_space -of default=nw=1 "$MP4" | tr '\n' ' '; echo
echo "== loop: t = DUR vs t = 0 (stills)"
node stills.mjs --times 0,12 >/dev/null 2>&1
md5 -q out/stills/en-9x16-t000.000.png out/stills/en-9x16-t012.000.png
echo "== determinism: the same frame twice"
node stills.mjs --times 5.6,8.2 >/dev/null 2>&1; A=$(md5 -q out/stills/en-9x16-t005.600.png out/stills/en-9x16-t008.200.png | tr '\n' ' ')
node stills.mjs --times 5.6,8.2 >/dev/null 2>&1; B=$(md5 -q out/stills/en-9x16-t005.600.png out/stills/en-9x16-t008.200.png | tr '\n' ' ')
echo "$A"; echo "$B"; [ "$A" = "$B" ] && echo "same" || echo "DIFFERENT"
echo "== the accent in the encoded video at 10.6 s (the lockup dot, centre of the dot)"
ffmpeg -v error -y -ss 10.6 -i "$MP4" -frames:v 1 -vf "scale=flags=accurate_rnd+full_chroma_int,format=rgb24" out/probe.png
python3 - <<'PY'
# ffmpeg hands over the frame as raw RGB; find the lockup dot and average a box inside it
import subprocess
out=subprocess.run(['ffmpeg','-v','error','-i','out/probe.png','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
w,h=1080,1920
def px(x,y): i=(y*w+x)*3; return tuple(out[i:i+3])
best=None
for y in range(850,1000,2):
    for x in range(700,900,2):
        r,g,b=px(x,y)
        if b>200 and 90<g<150 and r<120:  # the sample's accent #4F7CFF; change with your tokens
            best=(x,y,(r,g,b)); break
    if best: break
print('first orange pixel', best)
# average over a 20px box around the dot centre found
if best:
    x0,y0=best[0]+15,best[1]+15
    vals=[px(x,y) for y in range(y0-6,y0+6) for x in range(x0-6,x0+6)]
    print('mean', tuple(round(sum(v[i] for v in vals)/len(vals)) for i in range(3)), 'target (79, 124, 255)')
PY
echo "== phone test"
ffmpeg -v error -y -i "$MP4" -vf "fps=1,scale=360:-1,tile=6x2" -frames:v 1 out/phone.png && echo out/phone.png
