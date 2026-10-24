"""Create controlled local audio fixtures; never records the user's microphone."""
import hashlib,subprocess,urllib.request,wave
from pathlib import Path
import numpy as np
import soundfile as sf
import truststore
truststore.inject_into_ssl()
root=Path('.backups/speech-evaluation');root.mkdir(parents=True,exist_ok=True)
texts={
'hci':('Daniel','160','Today we will discuss thematic analysis. First, read the interview transcript carefully. Then assign codes to meaningful sections of the data. Group similar codes into themes, and check each theme against the original evidence. A theme is more than a topic label. It should describe a pattern that helps answer the research question. Finally, report your findings with clear examples and explain the limitations of your study.'),
'ml':('Samantha','165','A single layer neural network produces a linear decision boundary. It cannot solve the exclusive or problem because the classes are not linearly separable. A multilayer network introduces hidden units and nonlinear activation functions. During training, backpropagation computes gradients of the loss with respect to the parameters. Regularisation can reduce overfitting, but performance must be evaluated on a separate validation set.')}
for name,(voice,rate,text) in texts.items():
    ref=root/f'{name}-reference.txt';ref.write_text(text)
    subprocess.run(['say','-v',voice,'-r',rate,'-f',str(ref),'-o',str(root/f'{name}.aiff')],check=True)
    subprocess.run(['ffmpeg','-y','-v','error','-i',str(root/f'{name}.aiff'),'-ar','16000','-ac','1',str(root/f'{name}.wav')],check=True)
url='https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/samples/jfk.wav'
data=urllib.request.urlopen(url,timeout=60).read()
if hashlib.sha256(data).hexdigest()!='59dfb9a4acb36fe2a2affc14bacbee2920ff435cb13cc314a08c13f66ba7860e':
    raise RuntimeError('Public sample differs from evaluated version; review before accepting.')
(root/'jfk.wav').write_bytes(data)
(root/'jfk-reference.txt').write_text('And so my fellow Americans ask not what your country can do for you ask what you can do for your country.')
(root/'silence-reference.txt').write_text('')
with wave.open(str(root/'silence.wav'),'wb') as w:
    w.setnchannels(1);w.setsampwidth(2);w.setframerate(16000);w.writeframes(b'\0'*32000*5)
x,sr=sf.read(root/'hci.wav',dtype='float32');noise=np.random.default_rng(20261024).normal(0,1,len(x));noise*=np.sqrt(np.mean(x*x))/(10**(10/20)*np.sqrt(np.mean(noise*noise)))
sf.write(root/'hci-noisy.wav',np.clip(x+noise,-1,1),sr,subtype='PCM_16');(root/'hci-noisy-reference.txt').write_text(texts['hci'][2])
parts=[];references=[]
for name in ['hci','ml','jfk']:
    with wave.open(str(root/f'{name}.wav'),'rb') as w:
        assert (w.getnchannels(),w.getsampwidth(),w.getframerate())==(1,2,16000)
        parts.append(w.readframes(w.getnframes()))
    references.append((root/f'{name}-reference.txt').read_text())
with wave.open(str(root/'continuous.wav'),'wb') as w:
    w.setnchannels(1);w.setsampwidth(2);w.setframerate(16000);w.writeframes((b'\0'*32000).join(parts))
(root/'continuous-reference.txt').write_text(' '.join(references))
print('Prepared controlled synthetic/real public audio, 10dB synthetic white noise, silence and a continuous >60s stream.')
