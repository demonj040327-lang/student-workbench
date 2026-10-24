"""Pace known WAV audio through WLK's real WebSocket service (no fake ASR).

Run inside the isolated speech venv. Raw results stay in the ignored .backups.
First-text time is measured from clip start, not a per-word latency estimate.
"""
import argparse,asyncio,json,re,time,wave,hashlib,statistics
from pathlib import Path
from urllib.parse import urlencode,urlsplit
from urllib.request import urlopen
import websockets

def tokens(text):
    return re.findall(r"[a-z0-9]+",text.lower().replace("'",'').replace("-",''))

def word_error(reference,hypothesis):
    a,b=tokens(reference),tokens(hypothesis)
    row=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        new=[i]
        for j,y in enumerate(b,1):
            new.append(min(row[j]+1,new[-1]+1,row[j-1]+(x!=y)))
        row=new
    return {'reference_words':len(a),'word_edits':row[-1],'wer':round(row[-1]/len(a),4) if a else None}

async def run_one(base,stem,url,model):
    path=base/f'{stem}.wav';reference=(base/f'{stem}-reference.txt').read_text().strip()
    with wave.open(str(path),'rb') as audio:
        assert (audio.getnchannels(),audio.getsampwidth(),audio.getframerate())==(1,2,16000),'Expected mono PCM16 16kHz WAV'
        pcm=audio.readframes(audio.getnframes());duration=audio.getnframes()/16000
    events=[];first_text=None;first_confirmed=None;final={};lags=[];finished=False
    async with websockets.connect(url+'?'+urlencode({'language':'en','context':'Human-computer interaction, thematic analysis, neural network, backpropagation, regularisation.'}),max_size=8_000_000,open_timeout=15,ping_interval=20) as ws:
        config=json.loads(await ws.recv());assert config.get('useAudioWorklet') is True,'Start service with --pcm-input'
        started=time.monotonic()
        async def receive():
            nonlocal first_text,first_confirmed,final,finished
            async for raw in ws:
                value=json.loads(raw);elapsed=time.monotonic()-started;events.append({'received_seconds':round(elapsed,3),'message':value})
                if value.get('error') or value.get('status')=='error':raise RuntimeError(str(value))
                if value.get('type')=='ready_to_stop':finished=True;break
                if 'lines' in value:
                    final=value
                    text=' '.join(v.get('text') or '' for v in value['lines'])
                    if text.strip() and first_confirmed is None:first_confirmed=elapsed
                    if (text.strip() or value.get('buffer_transcription','').strip()) and first_text is None:first_text=elapsed
                    for line in value['lines'][-1:]:
                        if line.get('text'):
                            try:
                                parts=[float(v) for v in line['end'].split(':')];end=sum(v*60**i for i,v in enumerate(reversed(parts)));lags.append(max(0,elapsed-end))
                            except (ValueError,KeyError):pass
        receiver=asyncio.create_task(receive())
        packet=16000 # 0.5 seconds, paced at absolute sample deadlines
        for offset in range(0,len(pcm),packet):
            frame=pcm[offset:offset+packet];deadline=started+(offset+len(frame))/32000
            await asyncio.sleep(max(0,deadline-time.monotonic()))
            if receiver.done():await receiver;raise RuntimeError('ASR closed before end of input')
            await ws.send(frame)
        eof=time.monotonic();await ws.send(b'')
        await asyncio.wait_for(receiver,90);total=time.monotonic()-started
    if not finished:raise RuntimeError('No ready_to_stop; final drainage unverified')
    hypothesis=' '.join(line.get('text') or '' for line in final.get('lines',[])).strip()
    result={'sample':stem,'model':model,'audio_seconds':round(duration,3),'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'first_text_seconds':round(first_text,3) if first_text is not None else None,'first_confirmed_seconds':round(first_confirmed,3) if first_confirmed is not None else None,'after_audio_drain_seconds':round(total-(eof-started),3),'total_wall_seconds':round(total,3),'updates':len(events),'reference':reference,'transcript':hypothesis,'normalization':'lowercase; remove apostrophes and hyphens; ignore other punctuation/whitespace',**word_error(reference,hypothesis)}
    if not reference:result['silence_hallucination']=bool(hypothesis)
    (base/f'{model}-{stem}-events.json').write_text(json.dumps(events,ensure_ascii=False,indent=2))
    (base/f'{model}-{stem}-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps(result,ensure_ascii=False),flush=True)
    return result

async def main(args):
    root=Path(args.root);results=[]
    endpoint=urlsplit(args.url);http=('https' if endpoint.scheme=='wss' else 'http')+'://'+endpoint.netloc
    with urlopen(http+'/v1/models',timeout=5) as response: deployed=json.load(response)
    if not any(m['id'].endswith('/'+args.model) for m in deployed['data']):raise RuntimeError('Requested result label does not match the deployed model')
    for stem in args.samples:
        results.append(await run_one(root,stem,args.url,args.model))
    (root/f'{args.model}-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',default='.backups/speech-evaluation');p.add_argument('--url',default='ws://127.0.0.1:8000/asr');p.add_argument('--model',default='base.en');p.add_argument('--samples',nargs='+',default=['jfk','hci','ml','silence']);asyncio.run(main(p.parse_args()))
