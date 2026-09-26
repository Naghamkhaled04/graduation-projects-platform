"""
يحوّل ملف سحب أبيلا (من tools/abela-scraper.js) لكتالوج المتجر: site/src/data/abela.json

    python3 tools/abela-import.py path/to/abela-scrape.json

- القسم: لو المنتج موجود بكتالوج نوفاتيرا القديم بنفس الاسم بناخد قسمه العربي (مرتّب يدوياً)،
  غير هيك بنترجم قسم أبيلا. المقاومات والمكثفات والترانزستورات إلها أقسام خاصة.
- "New Items" و "Big sale" مش أقسام حقيقية.
- المنتجات اللي سعرها صفر بتنشال (سعر غلط أسوأ من ما في سعر).
"""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / 'site/src/data'

AB2AR = {
    'Microcontroller': 'متحكمات وألواح تطوير', 'Raspberry pi': 'راسبيري باي', 'Arduino and ESP kits': 'أطقم أردوينو',
    'Wireless Modules': 'وحدات لاسلكية', 'Sensor and Module': 'حساسات ووحدات', 'Motors and Drivers': 'محركات',
    'Display': 'شاشات', 'LEDs': 'ليدات وإضاءة', 'Robot kit': 'أطقم روبوت', 'Kids kit': 'أطقم للأطفال',
    'Power Supplies': 'طاقة ومزوّدات', '3D printer + CNC': 'طباعة ثلاثية الأبعاد و CNC', 'Smart Home': 'المنزل الذكي',
    'Batteries': 'بطاريات', 'Connectors ,Wires and other': 'أسلاك وموصلات',
}
FAKE = re.compile(r'new items|big sale', re.I)

# أقسام القطع الإلكترونية الأساسية — بالاسم، لأن أبيلا حاطّتهم ضمن "أسلاك وموصلات"
NOT_PART = re.compile(r'sensor|multimeter|bms|plc|optocoupler|ldr|photoresistor', re.I)
OWN = [
    ('مقاومات', re.compile(r'^resistor\b|resistor kit|cement resistor|potentiometer|trimpot|varistor', re.I)),
    ('مكثفات', re.compile(r'capacitor', re.I)),
    ('ترانزستورات', re.compile(r'transistor|mosfet|igbt', re.I)),
]

# لمنتجات بلا قسم عند أبيلا وما كانت بنوفاتيرا
GUESS = [
    ('مقاومات', re.compile(r'^resistance\b', re.I)),
    ('حساسات ووحدات', re.compile(r'sensor|ds18b20|sharp gp2|tds|keypad|pcf8574', re.I)),
    ('متحكمات وألواح تطوير', re.compile(r'esp32|stm32|arduino|board v\d', re.I)),
    ('محركات', re.compile(r'motor|relay|speaker', re.I)),
    ('طاقة ومزوّدات', re.compile(r'step up|step down|dc dc|buck|boost', re.I)),
    ('بطاريات', re.compile(r'battery|lithium', re.I)),
    ('ليدات وإضاءة', re.compile(r'\bled\b|rgb', re.I)),
    ('طباعة ثلاثية الأبعاد و CNC', re.compile(r'gt2|pulley', re.I)),
    ('أسلاك وموصلات', re.compile(r'switch|lever|solder', re.I)),
]

key = lambda s: re.sub(r'[^a-z0-9]+', '', s.lower())


def main(src):
    raw = json.load(open(src, encoding='utf-8'))
    prods = raw['products']
    prods = list(prods.values()) if isinstance(prods, dict) else prods
    old = {key(p['nm']): p['cat'] for p in json.load(open(DATA / 'novatera.json', encoding='utf-8'))}

    out, dropped = [], []
    for p in prods:
        if not p.get('p'):
            dropped.append(p['nm']); continue
        cat = next((c for c, rx in OWN if rx.search(p['nm']) and not NOT_PART.search(p['nm'])), None)
        if not cat:
            real = [c for c in [p.get('cat'), *p.get('cats', [])] if c and not FAKE.search(c)]
            prev = old.get(key(p['nm']))
            cat = (prev if prev != 'متنوّعات' else None) or (AB2AR.get(real[0]) if real else None) \
                or next((c for c, rx in GUESS if rx.search(p['nm'])), 'متنوّعات')
        out.append({'id': p['id'], 'nm': p['nm'], 'cat': cat, 'p': p['p'], 'img': p['img']})

    out.sort(key=lambda x: x['nm'].lower())
    with open(DATA / 'abela.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'{len(out)} منتج بالمتجر · انشال {len(dropped)} سعره صفر: {dropped}')


if __name__ == '__main__':
    main(sys.argv[1])
