/** The existing Wild multiplier cue, shared by expansion and spinning taps. */
export function playMultiplierTone(context: AudioContext, ended: () => void = () => {}) {
 const oscillator=context.createOscillator(), gain=context.createGain();
 oscillator.type='sine';oscillator.frequency.value=440;
 gain.gain.setValueAtTime(.025,context.currentTime);
 gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.25);
 oscillator.connect(gain);gain.connect(context.destination);
 oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();ended();};
 oscillator.start();oscillator.stop(context.currentTime+.25);
 return ()=>{oscillator.stop();};
}

export function createSpinTapAudio(context: AudioContext) {
 let timer: ReturnType<typeof setInterval> | undefined;
 let generation=0,disposed=false;
 const voices=new Set<()=>void>();
 function stop(){
  generation++;clearInterval(timer);timer=undefined;
  for(const end of voices)end();voices.clear();
 }
 return {
  start(){
   if(disposed)return;
   stop();const request=generation;
   void context.resume().then(()=>{
    if(disposed||request!==generation||context.state!=='running')return;
    const tap=()=>{let end:()=>void;end=playMultiplierTone(context,()=>voices.delete(end));voices.add(end);};
    tap();timer=setInterval(tap,320);
   }).catch(()=>{});
  },
  stop,
  dispose(){disposed=true;stop();},
 };
}
