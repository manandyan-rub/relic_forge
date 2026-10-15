"""Natural sampling report; does not claim calibrated lookup RTP."""
import argparse,json,statistics
from model import MODES,generate
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--sims',type=int,default=10000);a=p.parse_args()
    for mode in MODES:
        books=[generate(mode,i) for i in range(a.sims)]
        xs=[b['payoutMultiplier']/100 for b in books]
        print(json.dumps(dict(mode=mode,naturalSampleRtp=statistics.mean(xs),standardDeviationX=statistics.pstdev(xs),bonusFrequency=sum(b['criteria']=='feature' for b in books)/a.sims,status='Natural sampling, not the exported lookup distribution')))
