"""Lossless source preservation; only crop transparent margins and web-resize.
No repainting, segmentation, background removal, or generated artwork.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops
import json, hashlib, shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('C:/Users/user/Downloads')
ENTRIES = [
 ('bloom-keeper','Untitled91_0004-35-53.png','Bloom gnome / premium keeper',1000),
 ('bloom-traveler','Untitled90 (2).png','Bloom traveler premium',650),
 ('bloom-traveler-stage','Untitled90 (2).png','Main Bloom character beside the reels',1200),
 ('bloom-guardian','Ռիմա2_20260607152304.png','Bloom guardian premium',650),
 ('blight-keeper','Untitled94 (1).png','Blight hooded creature / premium keeper',1000),
 ('blight-traveler','Untitled92 (2).png','Blight skull gnome premium',650),
 ('blight-guardian','Untitled108 (1).png','Blight brute premium',650),
 ('bloom-room','Untitled97_Restored2.jpg','Bloom environment',2400),
 ('bloom-bedroom','Untitled97_Restored3.jpg','Additional Bloom scene',2000),
 ('blight-room','Untitled97_Restored_20260607113127.jpg','Blight environment, no character',2400),
 ('blight-composite','Untitled97_Restored_20260607113326.jpg','Reference composite, not used behind independent character',1600),
 ('logo','Untitled122.png','The Last Petal logo',650),
 ('bloom-keeper-alternate','Untitled91_0004-35-53 (1).png','Alternate supplied gnome reference',650),
 ('bloom-keeper-symbol','Untitled91_0004-35-53.png','Keeper reel thumbnail',240),
 ('blight-keeper-symbol','Untitled94 (1).png','Keeper reel thumbnail',240),
 ('bloom-tools-sheet','Untitled93.png','Separated Bloom props source sheet',1000),
 ('traveler-tools-sheet','Untitled95.png','Separated traveler props source sheet',1000),
 ('traveler-hammer','Untitled91 (1).png','Traveler hammer',320),
 ('blight-tools-sheet','Untitled110.png','Hooded keeper props source sheet',1000),
 ('skull-tools-sheet','Untitled97.png','Skull gnome props source sheet',1000),
 ('brute-tools-sheet','Untitled118.png','Corrupted brute props source sheet',1000),
 ('guardian-charms-sheet','Ռիմա3.png','Guardian scarf, brooch and pendant source sheet',800),
]
ACTIVE_ASSET_IDS = ['blight-book', 'blight-flower', 'blight-guardian', 'blight-keeper', 'blight-keeper-symbol', 'blight-key', 'blight-lantern', 'blight-mushroom', 'blight-room', 'blight-traveler', 'bloom-book', 'bloom-flower', 'bloom-guardian', 'bloom-keeper-symbol', 'bloom-key', 'bloom-lantern', 'bloom-mushroom', 'bloom-room', 'bloom-traveler', 'bloom-traveler-stage']
REGIONS = [
 ('bloom-flower','Untitled93.png',(.14,.25,.35,.39),'Flowerpot reel symbol'),
 ('bloom-lantern','Untitled95.png',(.145,.16,.25,.295),'Lantern reel symbol'),
 ('bloom-key','Ռիմա3.png',(.31,.32,.38,.37),'Guardian brooch reel symbol'),
 ('bloom-book','Untitled91 (1).png',(.59,.53,.81,.665),'Traveler hammer reel symbol'),
 ('bloom-mushroom','Untitled95.png',(.325,.072,.79,.32),'Traveler hat reel symbol'),
 ('blight-flower','Untitled97.png',(.15,.40,.34,.50),'Stone reel symbol'),
 ('blight-lantern','Untitled110.png',(.19,.27,.34,.53),'Chained flail reel symbol'),
 ('blight-key','Untitled97.png',(.56,.535,.72,.635),'Belt pouch reel symbol'),
 ('blight-book','Untitled97.png',(.54,.53,.87,.78),'Shears reel symbol'),
 ('blight-mushroom','Untitled118.png',(.48,.56,.81,.77),'Spiked club reel symbol'),
]
# Hand-traced selection boundaries in a 900 x 1272 view of the supplied atlases.
# Alpha masking only removes neighboring props; it never repaints source pixels.
PROP_OUTLINES = {
 'blight-book': [(492,947),(606,812),(614,796),(631,779),(650,778),(748,688),(773,682),(779,700),(674,817),(645,894),(593,979),(572,981),(586,937),(608,873),(540,934)],
 'blight-key': [(552,695),(583,688),(610,692),(620,679),(638,692),(638,721),(623,731),(622,758),(610,784),(599,789),(603,800),(585,804),(575,791),(556,791),(530,783),(516,769),(505,745),(509,729),(526,724),(543,716)],
 'blight-mushroom': [(435,935),(477,877),(535,829),(595,783),(660,732),(682,699),(715,700),(726,728),(684,789),(655,837),(617,889),(565,950),(530,986),(485,987),(445,974)],
}
def main():
    target = ROOT/'static'/'art'
    originals = ROOT/'art'/'sources'
    target.mkdir(parents=True,exist_ok=True)
    originals.mkdir(parents=True,exist_ok=True)
    manifest=[]
    for key,name,role,size in ENTRIES:
        src=SOURCE/name
        shutil.copy2(src,originals/name)
        if key not in ACTIVE_ASSET_IDS: continue
        im=Image.open(src)
        if im.mode=='RGBA':
            im=im.crop(im.getchannel('A').getbbox())
        im.thumbnail((size,size),Image.Resampling.LANCZOS)
        dest=target/f'{key}.webp'
        im.save(dest,'WEBP',quality=88,method=6)
        manifest.append(dict(id=key,source=str(src),preservedSource=f'art/sources/{name}',
            sha256=hashlib.sha256(src.read_bytes()).hexdigest(),role=role,url=f'/art/{key}.webp',
            dimensions=list(im.size),bytes=dest.stat().st_size))
    for key,name,region,role in REGIONS:
        src=SOURCE/name
        im=Image.open(src)
        w,h=im.size
        if key in PROP_OUTLINES:
            mask=Image.new('L',im.size)
            ImageDraw.Draw(mask).polygon([(round(x*w/900),round(y*h/1272)) for x,y in PROP_OUTLINES[key]],fill=255)
            im.putalpha(ImageChops.multiply(im.getchannel('A'),mask))
        else:
            im=im.crop(tuple(round(v*(w if i%2==0 else h)) for i,v in enumerate(region)))
        if im.mode=='RGBA' and im.getchannel('A').getbbox(): im=im.crop(im.getchannel('A').getbbox())
        im.thumbnail((240,240),Image.Resampling.LANCZOS)
        dest=target/f'{key}.webp'
        im.save(dest,'WEBP',quality=90,method=6)
        manifest.append(dict(id=key,source=str(src),preservedSource=f'art/sources/{name}',
            sha256=hashlib.sha256(src.read_bytes()).hexdigest(),role=role,sourceRegion=region,
            sourcePolygon=PROP_OUTLINES.get(key),
            url=f'/art/{key}.webp',dimensions=list(im.size),bytes=dest.stat().st_size))
    (ROOT/'art'/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')
    print(f'Prepared {len(manifest)} web assets; original sources preserved.')
if __name__=='__main__': main()
