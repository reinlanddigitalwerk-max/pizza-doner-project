# Erzeugt quadratische 192px-Bilder für die Speisekarte und eine Liste der Quellen.
import json, sys, os
from PIL import Image, ImageOps
S, REPO = sys.argv[1], sys.argv[2]
PICK = {
 "pizza-margherita": ("ov2", "pizza-margherita", 3), "pizza-salami": ("ov2", "pizza-salami", 1),
 "pizza-schinken": ("ov2", "pizza-schinken", 3), "pizza-funghi": ("ov2", "pizza-funghi", 4),
 "pizza-tonno": ("ov2", "pizza-salami", 0), "pizza-hawaii": ("ov2", "pizza-schinken", 1),
 "pizza-diavolo": ("full", "f112e488", None), "pizza-sucuk": ("ov3", "pizza-sucuk", 1),
 "pizza-paprika": ("ov3", "pizza-paprika", 5), "pizza-spinat": ("ov2", "pizza-spinat", 0),
 "pizza-vegetaria": ("ov2", "pizza-vegetaria", 0), "pizza-nepal": ("ov2", "pizza-nepal", 3),
 "pizza-quattro-stagioni": ("ov2", "pizza-quattro-stagioni", 1), "pizza-chicken": ("ov2", "pizza-chicken", 5),
 "pizza-bbq-chicken": ("ov2", "pizza-bbq-chicken", 0), "pizza-quattro-formaggi": ("ov2", "pizza-quattro-formaggi", 2),
 "calzone": ("ov2", "calzone", 4),
 "salat-gemischt": ("ov2", "salat-gemischt", 1), "salat-doener": ("ov2", "salat-doener", 2),
 "salat-thunfisch": ("ov2", "salat-thunfisch", 4), "salat-bauern": ("ov2", "salat-bauern", 1),
 "salat-tasche": ("ov2", "salat-wrap", 2), "salat-wrap": ("ov3", "salat-wrap", 0),
 "doener-sandwich": ("ov3", "doener-sandwich", 4), "doener-wrap": ("ov3", "doener-wrap", 0),
 "doener-wrap-menue": ("ov3", "doener-wrap", 2), "doener-fleisch": ("ov2", "doener-fleisch", 2),
 "doener-teller": ("full", "3ee68183", None), "doener-box": ("ov2", "salat-doener", 2),
 "doener-reis": ("ov2", "doener-reis", 3), "doener-ueberbacken": ("ov2", "pizza-funghi", 0),
 "lahmacun": ("full", "2699a3e3", None), "lahmacun-salat": ("ov2", "lahmacun-salat", 0),
 "falafel-sandwich": ("ov2", "falafel-sandwich", 1), "falafel-wrap": ("ov2", "falafel-wrap", 3),
 "falafel-teller": ("ov2", "falafel-teller", 0), "pide": ("ov4", "pide-a", 1),
 "schnitzel": ("ov2", "schnitzel", 0), "jaegerschnitzel": ("ov2", "schnitzel", 3),
 "paprikaschnitzel": ("ov2", "schnitzel", 1), "hamburger": ("ov2", "hamburger", 0),
 "cheeseburger": ("ov2", "cheeseburger", 1), "chili-cheeseburger": ("ov2", "cheeseburger", 5),
 "chickenburger": ("ov2", "chickenburger", 5), "pizzabroetchen": ("ov3", "pizzabroetchen", 1),
 "chicken-nuggets": ("ov2", "chicken-nuggets", 2), "kinder-menue": ("ov2", "chicken-nuggets", 0),
 "currywurst": ("ov2", "currywurst", 0), "currywurst-pommes": ("ov2", "currywurst", 5),
 "chicken-bowl": ("ov2", "chicken-bowl", 2), "pommes": ("ov2", "pommes", 1), "reis": ("ov2", "reis", 1),
 "peperoni": ("ov2", "peperoni", 5), "oliven": ("ov3", "oliven", 2),
 "ketchup": ("ov2", "ketchup", 3), "mayonnaise": ("ov2", "ketchup", 5), "tzatziki": ("ov2", "tzatziki", 4),
 "cocktailsauce": ("ov2", "cocktailsauce", 4), "currysauce": ("ov2", "currysauce", 2),
 "pilzsauce": ("ov2", "pilzsauce", 0), "paprikasauce": ("ov2", "paprikasauce", 2),
 "scharfe-sauce": ("ov2", "scharfe-sauce", 1), "aioli": ("ov2", "aioli", 5),
 "kraeuterbutter": ("ov3", "kraeuterbutter", 2),
 "cola": ("ov2", "cola", 5), "orangenlimonade": ("ov2", "zitronenlimonade", 2),
 "zitronenlimonade": ("ov2", "zitronenlimonade", 1), "wasser": ("ov3", "wasser", 4),
 "ayran": ("ov2", "ayran", 2), "eistee": ("ov3", "eistee", 5),
}
full_meta = json.load(open(f'{S}/ov/picks_meta.json'))
results = {d: json.load(open(f'{S}/{d}/results.json')) for d in ('ov2', 'ov3', 'ov4')}
out = f'{REPO}/assets/img/menu'; os.makedirs(out, exist_ok=True)
credits = {}
for key, (d, k, i) in PICK.items():
    if d == 'full':
        src = f'{S}/ov/full/{k}.jpg'; m = full_meta[k]
        meta = {'titel': m['title'], 'urheber': m['creator'], 'lizenz': m['license'], 'quelle': m['landing']}
    else:
        src = f'{S}/{d}/th/{k}_{i}.jpg'; r = results[d][k][i]
        meta = {'titel': r['title'], 'urheber': r.get('creator'), 'lizenz': r['license'], 'quelle': r.get('foreign_landing_url')}
    im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    w, h = im.size; side = int(min(w, h) * 0.92)
    box = ((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2)
    sq = im.crop(box)
    sq.resize((192, 192), Image.LANCZOS).save(f'{out}/{key}.webp', 'WEBP', quality=82, method=6)
    big = min(480, sq.width)
    sq.resize((big, big), Image.LANCZOS).save(f'{out}/{key}-l.webp', 'WEBP', quality=80, method=6)
    credits[key] = meta
json.dump(credits, open(f'{REPO}/assets/img/menu/quellen.json', 'w'), ensure_ascii=False, indent=1)
print(len(credits), 'Bilder')
