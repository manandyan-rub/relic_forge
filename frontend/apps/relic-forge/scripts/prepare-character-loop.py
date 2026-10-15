"""Build continuous character spin loops from existing transparent source frames.
Uses premultiplied-alpha temporal blending and a cosine-paced forward/return edit.
"""
from pathlib import Path
from PIL import Image
import argparse,hashlib,json,math,subprocess
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--frames',type=Path);p.add_argument('--video',type=Path);p.add_argument('--output-name',required=True);p.add_argument('--source-start',type=float,required=True);p.add_argument('--source-duration',type=float,default=.75);p.add_argument('--source-fps',type=int,default=24);p.add_argument('--frame-pattern',default='alpha-%03d.png');p.add_argument('--cycle-duration',type=float,default=2);p.add_argument('--source-kind',default='original-transparent-source');p.add_argument('--scratch',type=Path,required=True);args=p.parse_args()
root=Path(__file__).resolve().parents[1];args.scratch.mkdir(parents=True,exist_ok=True)
if bool(args.frames)==bool(args.video):raise ValueError('Provide exactly one of --frames or --video')
if args.video:
 args.frames=args.scratch/'source';args.frames.mkdir(exist_ok=True)
 args.frame_pattern='frame-%03d.png'
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(args.video),'-vf',f'fps={args.source_fps}','-start_number','0',str(args.frames/args.frame_pattern)],check=True)
# Use a short source interval and slow smoothly at both direction changes.
fps=60;count=round(args.cycle_duration*fps);last=max(1,round(args.source_duration*args.source_fps)-1)
indices=[last*(1-math.cos(2*math.pi*i/count))/2 for i in range(count)]
frames=[]
for index in range(last+1):
 with Image.open(args.frames/(args.frame_pattern % index)) as im:
  rgba=np.asarray(im.convert('RGBA'),dtype=np.float32)/255
  rgba[:,:,:3]*=rgba[:,:,3:4]
  frames.append(rgba)
for i,index in enumerate(indices):
 low=math.floor(index);high=min(last,low+1);weight=index-low
 rgba=frames[low]*(1-weight)+frames[high]*weight
 alpha=rgba[:,:,3:4]
 rgba[:,:,:3]=np.divide(rgba[:,:,:3],alpha,out=np.zeros_like(rgba[:,:,:3]),where=alpha>1e-5)
 Image.fromarray(np.clip(np.round(rgba*255),0,255).astype(np.uint8),'RGBA').save(args.scratch/f'loop-{i:03d}.png')
out=root/'static/art'/f'{args.output_name}.webm'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate',str(fps),'-i',str(args.scratch/'loop-%03d.png'),'-frames:v',str(count),'-an','-c:v','libvpx-vp9','-pix_fmt','yuva420p','-auto-alt-ref','0','-b:v','0','-crf','28','-deadline','good','-cpu-used','3','-metadata:s:v:0','alpha_mode=1',str(out)],check=True)
with Image.open(args.frames/(args.frame_pattern % 0)) as im:im.save(root/'static/art'/f'{args.output_name}-poster.webp','WEBP',quality=90,method=6)
meta={'sourceStartSeconds':args.source_start,'sourceEndSeconds':args.source_start+args.source_duration,'sourceFps':args.source_fps,'sourceKind':args.source_kind,'preparedSource':str(args.video) if args.video else None,'edit':'60fps premultiplied-alpha temporal blending, cosine-paced forward/return; spin is silent','durationSeconds':args.cycle_duration,'frames':count,'fps':fps,'sourceFrameIndices':indices,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}
(root/'art'/f'{args.output_name}-loop.json').write_text(json.dumps(meta,indent=2),encoding='utf-8');print(json.dumps(meta))
