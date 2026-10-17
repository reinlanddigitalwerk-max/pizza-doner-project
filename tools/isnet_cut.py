# Freistellen mit ISNet (gleiches Modell wie rembg "isnet-general-use").
import sys, numpy as np, onnxruntime as ort
from PIL import Image, ImageFilter
model, out_dir, *files = sys.argv[1:]
sess = ort.InferenceSession(model, providers=['CPUExecutionProvider'])
name = sess.get_inputs()[0].name
for f in files:
    img = Image.open(f).convert('RGB')
    x = np.asarray(img.resize((1024, 1024), Image.LANCZOS)).astype(np.float32) / 255.0
    x = (x - 0.5) / 1.0
    x = x.transpose(2, 0, 1)[None]
    pred = sess.run(None, {name: x})[0][0, 0]
    pred = (pred - pred.min()) / (pred.max() - pred.min() + 1e-8)
    mask = Image.fromarray((pred * 255).astype(np.uint8)).resize(img.size, Image.LANCZOS)
    out = img.convert('RGBA'); out.putalpha(mask)
    out = out.crop(out.getbbox())
    dst = f"{out_dir}/{f.rsplit('/', 1)[-1]}"
    out.save(dst)
    print(dst, out.size)
