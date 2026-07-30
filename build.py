#!/usr/bin/env python3
"""
Compile index.html + styles.css + js modules into a single last-call-app.html,
matching the pattern already established in the checked-in compiled file:
  - styles.css inlined into a <style> block in <head>
  - all local modules concatenated (in dependency order) into one
    <script type="module"> block, external CDN imports kept, local
    import/export statements stripped, each file marked with a
    "/* ---- filename.js ---- */" comment.
"""
import re

MODULE_ORDER = ['config.js', 'utils.js', 'brand.js', 'qr.js', 'settlement.js', 'app.js']

def strip_local_imports(src):
    # Drop any import line pulling from a local ('./...') file — those
    # bindings just become plain top-level declarations once everything's
    # concatenated into one scope.
    lines = src.split('\n')
    out = []
    for line in lines:
        if re.match(r"^\s*import\s.*from\s+'\./", line):
            continue
        out.append(line)
    return '\n'.join(out)

def strip_export_keyword(src):
    # `export const x` -> `const x`, `export function f` -> `function f`, etc.
    src = re.sub(r'^export\s+(const|let|var|function|async function|class)\s', r'\1 ', src, flags=re.MULTILINE)
    return src

with open('index.html') as f:
    html = f.read()

with open('styles.css') as f:
    css = f.read()

# Inline the stylesheet
html = html.replace(
    '<link rel="stylesheet" href="styles.css">',
    f'<style>\n{css}\n</style>'
)

# Build the merged module body
external_imports = []
seen_externals = set()
body_parts = []

for fname in MODULE_ORDER:
    with open(fname) as f:
        src = f.read()
    for line in src.split('\n'):
        m = re.match(r"^\s*(import\s.*from\s+'(?!\./).*';?)\s*$", line)
        if m and m.group(1) not in seen_externals:
            seen_externals.add(m.group(1))
            external_imports.append(m.group(1))
    src = re.sub(r"^\s*import\s.*from\s+'(?!\./).*';?\s*$", '', src, flags=re.MULTILINE)
    src = strip_local_imports(src)
    src = strip_export_keyword(src)
    body_parts.append(f'/* ---- {fname} ---- */\n{src.strip()}')

merged_js = '\n'.join(external_imports) + '\n\n' + '\n\n'.join(body_parts)

html = html.replace(
    '<script type="module" src="js/app.js"></script>',
    f'<script type="module">\n{merged_js}\n</script>'
)

with open('last-call-app.html', 'w') as f:
    f.write(html)

print('Compiled last-call-app.html:', len(html), 'bytes')
