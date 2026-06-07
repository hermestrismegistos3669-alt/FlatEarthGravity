# Trismegistic Conical Gravity Field

Interaktivní Three.js web pro fiktivní/pseudovědecký model kónické gravitace na ploché Zemi ve tvaru komolého kužele.

## Co projekt obsahuje

- 3D model masivního komolého kužele
- horní obyvatelný disk
- radiálně a hloubkově proměnné hustotní vrstvy
- centrální dutinu „Ад“
- gravitační vektory kolmé k povrchu
- průhlednost, wireframe, řezovou rovinu
- ovládací panel přes `lil-gui`
- export screenshotu

## Struktura

```text
.
├── index.html
├── main.js
├── style.css
└── README.md
```

## Lokální spuštění

Protože `main.js` používá ES moduly, nespouštěj projekt dvojklikem na `index.html`. Použij lokální server:

```bash
python3 -m http.server 8000
```

Pak otevři:

```text
http://localhost:8000
```

## Publikace na GitHub Pages

1. Nahraj soubory `index.html`, `main.js`, `style.css`, `README.md` do rootu repozitáře.
2. Otevři `Settings → Pages`.
3. Nastav:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
4. Ulož.
5. Web bude dostupný na adrese typu:

```text
https://uzivatel.github.io/nazev-repozitare/
```

## Poznámka

Tento projekt je fikční prezentační model. Nejedná se o fyzikálně platný model Země.

Designed by Hermes Trismegistos.
