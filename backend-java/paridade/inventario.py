#!/usr/bin/env python3
"""Inventário mecânico de rotas: Node (Express) × Java (Spring MVC).

Lê backend/src/app.js (montagens) + backend/src/routes/*.js (rotas) e
backend-java/src/main/java/**/*Controller.java (mappings), normaliza os
parâmetros de caminho (:id / {id} → {}) e imprime o que existe só de um lado.
Uso: python3 paridade/inventario.py [--md]
"""
import os
import re
import sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
NODE = os.path.join(RAIZ, 'backend', 'src')
JAVA = os.path.join(RAIZ, 'backend-java', 'src', 'main', 'java')


def normalizar(path):
    path = re.sub(r':[A-Za-z_]+', '{}', path)
    path = re.sub(r'\{[^}]*\}', '{}', path)
    path = re.sub(r'/+', '/', path)
    if len(path) > 1 and path.endswith('/'):
        path = path[:-1]
    return path or '/'


def rotas_node():
    app = open(os.path.join(NODE, 'app.js'), encoding='utf-8').read()
    rotas = set()
    for m in re.finditer(r"app\.(get|post|put|patch|delete)\(\s*'([^']+)'", app):
        rotas.add((m.group(1).upper(), normalizar(m.group(2))))
    montagens = re.findall(r"app\.use\(\s*'([^']+)'\s*,\s*(?:require\('\./routes/(\w+)'\)|(\w+))\s*\)", app)
    for prefixo, req_mod, var in montagens:
        mod = req_mod or None
        if not mod:
            m = re.search(r"const %s = require\('\./routes/(\w+)'\)" % var, app)
            if not m:
                continue
            mod = m.group(1)
        src = open(os.path.join(NODE, 'routes', mod + '.js'), encoding='utf-8').read()
        src = re.sub(r'//[^\n]*', '', src)
        for m in re.finditer(r"router\.(get|post|put|patch|delete)\(\s*['\"]([^'\"]+)['\"]", src):
            rotas.add((m.group(1).upper(), normalizar(prefixo + m.group(2))))
    return rotas


def rotas_java():
    rotas = set()
    for pasta, _, ficheiros in os.walk(JAVA):
        for f in ficheiros:
            if not f.endswith('Controller.java'):
                continue
            src = open(os.path.join(pasta, f), encoding='utf-8').read()
            src = re.sub(r'//[^\n]*', '', src)
            classe = re.search(r'@RequestMapping\(\s*(?:value\s*=\s*)?"([^"]*)"\s*\)\s*\n\s*public\s+class', src)
            base = classe.group(1) if classe else ''
            corpo = src[classe.end():] if classe else src
            for m in re.finditer(r'@(Get|Post|Put|Patch|Delete)Mapping(?:\(\s*(?:value\s*=\s*|path\s*=\s*)?"([^"]*)"[^)]*\))?', corpo):
                rotas.add((m.group(1).upper(), normalizar(base + (m.group(2) or ''))))
            for m in re.finditer(r'@RequestMapping\(\s*(?:value\s*=\s*)?"([^"]*)"\s*,\s*method\s*=\s*RequestMethod\.(\w+)', corpo):
                rotas.add((m.group(2).upper(), normalizar(base + m.group(1))))
    return rotas


def main():
    node = rotas_node()
    java = rotas_java()
    so_node = sorted(node - java)
    so_java = sorted(java - node)
    md = '--md' in sys.argv
    print(f"Node: {len(node)} rotas | Java: {len(java)} rotas | comuns: {len(node & java)}")
    print(f"Só no Node ({len(so_node)}):")
    for m, p in so_node:
        print(f"  {'| ' if md else ''}{m} {p}")
    print(f"Só no Java ({len(so_java)}):")
    for m, p in so_java:
        print(f"  {'| ' if md else ''}{m} {p}")
    return 1 if so_node else 0


if __name__ == '__main__':
    sys.exit(main())
