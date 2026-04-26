import re
import json

# Read data from gallupTalents.ts
with open('frontend/data/gallupTalents.ts', 'r') as f:
    legacy_content = f.read()

legacy_talents = {}
for line in legacy_content.split('\n'):
    if '{ id:' in line:
        match_id = re.search(r"id:\s*'([^']+)'", line)
        match_desc = re.search(r"description:\s*'([^']+)'", line)
        match_descPl = re.search(r"descriptionPl:\s*'([^']+)'", line)
        if match_id and match_desc and match_descPl:
            legacy_talents[match_id.group(1).lower()] = {
                'en_desc': match_desc.group(1),
                'pl_desc': match_descPl.group(1).replace("'", "\\'")
            }

# Read data from gallup-data.ts
with open('frontend/lib/gallup-data.ts', 'r') as f:
    new_content = f.read()

# Interface update
new_content = new_content.replace(
    '    pl: string;\n    domain: GallupDomain;',
    "    pl: string;\n    en_desc?: string;\n    pl_desc?: string;\n    domain: GallupDomain;"
)

def replacer(match):
    code = match.group(1)
    en = match.group(2)
    pl = match.group(3)
    domain = match.group(4)
    
    # Try to find in legacy_talents
    search_key = code.lower()
    
    if search_key in legacy_talents:
        en_desc = legacy_talents[search_key]['en_desc']
        pl_desc = legacy_talents[search_key]['pl_desc']
        return f"    {{ code: '{code}', en: '{en}', pl: '{pl}', en_desc: '{en_desc}', pl_desc: '{pl_desc}', domain: '{domain}' }},"
    return match.group(0)

# Pattern: { code: 'Achiever', en: 'Achiever', pl: 'Osiąganie', domain: 'executing' },
pattern = r"\{\s*code:\s*'([^']+)',\s*en:\s*'([^']+)',\s*pl:\s*'([^']+)',\s*domain:\s*'([^']+)'\s*\},"
new_content = re.sub(pattern, replacer, new_content)

with open('frontend/lib/gallup-data.ts', 'w') as f:
    f.write(new_content)

print("Done")
