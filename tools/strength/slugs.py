# tools/commanders.txt (card names) -> EDHREC page names, one per line, for fetch.py's extra commanders
import sys, unicodedata, re
for line in open(sys.argv[1]):
    n = line.strip()
    if not n or n.startswith('#'): continue
    s = unicodedata.normalize('NFD', n.split(' // ')[0].lower())
    s = ''.join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r'[^a-z0-9 -]', '', s).strip()
    print(re.sub(r'\s+', '-', s))
