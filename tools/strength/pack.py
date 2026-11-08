# What the app reads (engine/strength.js), written into <out>:
#   strength.json.gz          {v, date, cards: {name: [rating with cEDH, rating without]}}  (cards rating 1 or more)
#   strength/<slug>.json      {u|o|c: [decks, {name: % of that bracket's decks}]}  (cards in 25% or more), one per commander
import json, glob, gzip, sys, os
S = sys.argv[1]; date = sys.argv[2]; OUT = sys.argv[3] if len(sys.argv) > 3 else S
A = json.load(open(S + '/r_new.json')); C = json.load(open(S + '/r_casual.json'))
cards = {n: [round(A[n]['r']), round(C.get(n, {}).get('r', 0))] for n in A if A[n]['r'] >= 1 or C.get(n, {}).get('r', 0) >= 1}
os.makedirs(OUT + '/strength', exist_ok=True)
n = 0; size = 0
for f in glob.glob(S + '/br/*.json'):
    slug = os.path.basename(f)[:-5]
    if '.' in slug: continue
    r = json.load(open(f)); out = {}
    for b in ['upgraded', 'optimized', 'cedh']:
        x = r['b'].get(b)
        if x and x['decks']: out[b[0]] = [x['decks'], {k: round(100 * a / p) for k, (a, p) in x['cards'].items() if a / p >= 0.25}]
    if out:
        raw = json.dumps(out, separators=(',', ':'), ensure_ascii=False)
        open(OUT + '/strength/' + slug + '.json', 'w').write(raw); n += 1; size += len(raw)
blob = json.dumps({'v': 1, 'date': date, 'cards': cards}, separators=(',', ':'), ensure_ascii=False).encode()
open(OUT + '/strength.json.gz', 'wb').write(gzip.compress(blob, 9))
print(len(cards), 'cards:', len(gzip.compress(blob, 9)) // 1024, 'KB gz;', n, 'commander files, average', size // max(1, n) // 1024, 'KB')
