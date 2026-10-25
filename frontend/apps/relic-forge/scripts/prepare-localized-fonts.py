"""Bundle OFL fonts subset to the shipped UI text; no runtime font service calls."""
import concurrent.futures
import hashlib
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

APP=Path(__file__).resolve().parents[1]
FONTS=APP/'static/fonts'
AGENT='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
FAMILIES={'ar':('Noto Sans Arabic','notosansarabic','Petal Arabic'),
          'ja':('Noto Sans JP','notosansjp','Petal Japanese'),
          'ko':('Noto Sans KR','notosanskr','Petal Korean'),
          'zh':('Noto Sans SC','notosanssc','Petal Chinese')}

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':AGENT}),timeout=45) as response:
        return response.read()

def prepare(item):
    lang,(family,slug,css_family)=item
    catalog=json.loads((APP/f'src/petal/locales/{lang}.json').read_text(encoding='utf-8'))
    chars={c for value in catalog.values() for c in value if ord(c)>=128}
    if lang=='ar':chars.update('٠١٢٣٤٥٦٧٨٩٪٫٬')
    text=''.join(sorted(chars))
    url='https://fonts.googleapis.com/css2?'+urllib.parse.urlencode({'family':family+':wght@400..700','text':text,'display':'swap'})
    css=get(url).decode()
    sources=re.findall(r'url\((https://[^)]+)\)',css)
    if len(set(sources))!=1:raise RuntimeError(f'Unexpected font response for {family}')
    data=get(sources[0])
    if data[:4]!=b'wOF2':raise RuntimeError(f'Expected WOFF2 font for {family}')
    filename=f'petal-{lang}-ui.woff2'
    (FONTS/filename).write_bytes(data)
    license_url=f'https://raw.githubusercontent.com/google/fonts/main/ofl/{slug}/OFL.txt'
    (FONTS/f'{slug}-OFL.txt').write_bytes(get(license_url))
    return dict(language=lang,family=family,cssFamily=css_family,file='fonts/'+filename,
                bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),characters=text,
                source=sources[0],licenseSource=license_url,method='Google Fonts CSS2 text subset, variable weight 400–700')

if __name__=='__main__':
    FONTS.mkdir(exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(prepare,FAMILIES.items()))
    (APP/'art/localized-fonts.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps([{k:r[k] for k in ('language','file','bytes')} for r in results]))
