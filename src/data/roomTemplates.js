/**
 * Voorgebouwde plattegrond-templates op basis van jouw woning.
 * Canvas: 800 × 600 px  (~70 px = 1 m)
 *
 * Woonkamer:  ca. 5 × 6 m  – TV-wand onderin, opening naar eetkamer rechts
 * Eetkamer/Keuken: ca. 7.5 × 5 m – Franse deuren links, keukeneiland rechts
 *
 * lightPlacements bevat positie-voorstellen (lightId = '' = nog te koppelen).
 */

export const ROOM_TEMPLATES = [
  {
    id: 'tpl_woonkamer',
    name: 'Woonkamer',
    width: 800,
    height: 600,
    // Buitenmuren + gedeelde wand (met opening rechts y 195-405)
    walls: [
      { x: 70,  y: 55  },  // links-boven
      { x: 730, y: 55  },  // rechts-boven
      { x: 730, y: 195 },  // gedeelde wand boven opening
      { x: 730, y: 405 },  // gedeelde wand onder opening
      { x: 730, y: 545 },  // rechts-onder
      { x: 70,  y: 545 },  // links-onder
      { x: 70,  y: 55  },  // sluiten
    ],
    // Boekenkasten links/rechts van de opening (als decoratieve muurstukjes)
    furniture: [
      { type: 'rect', x: 710, y: 195, w: 20, h: 55, label: 'Boekenkast' },
      { type: 'rect', x: 710, y: 350, w: 20, h: 55, label: 'Boekenkast' },
      // TV-meubel
      { type: 'rect', x: 200, y: 510, w: 220, h: 30, label: 'TV-meubel' },
      // Groene bank
      { type: 'rect', x: 100, y: 280, w: 190, h: 90, label: 'Bank (groen)' },
      // Grijze bank
      { type: 'rect', x: 130, y: 390, w: 200, h: 75, label: 'Bank (grijs)' },
    ],
    lightSuggestions: [
      { key: 'booglamp',   label: 'Booglamp',        x: 115, y: 200 },
      { key: 'tafellamp',  label: 'Tafellamp bank',  x: 640, y: 310 },
      { key: 'tv_strip',   label: 'Hue TV-strip',    x: 310, y: 520 },
      { key: 'tv_globe',   label: 'Bollampje TV',    x: 420, y: 510 },
    ],
    lightPlacements: [],
  },

  {
    id: 'tpl_eetkamer',
    name: 'Eetkamer / Keuken',
    width: 800,
    height: 600,
    // Buitenmuren + opening naar woonkamer links (y 195-405)
    walls: [
      { x: 70,  y: 55  },  // links-boven (Franse deuren zijde)
      { x: 730, y: 55  },  // rechts-boven
      { x: 730, y: 545 },  // rechts-onder (ingang)
      { x: 70,  y: 545 },  // links-onder
      { x: 70,  y: 405 },  // gedeelde wand onder opening
      { x: 70,  y: 195 },  // gedeelde wand boven opening
      { x: 70,  y: 55  },  // sluiten
    ],
    furniture: [
      // Eettafel
      { type: 'rect', x: 260, y: 180, w: 200, h: 280, label: 'Eettafel' },
      // Keukeneiland
      { type: 'rect', x: 530, y: 350, w: 170, h: 55, label: 'Keukeneiland' },
      // Franse deuren (bovenwand markering)
      { type: 'rect', x: 185, y: 55,  w: 200, h: 12, label: 'Franse deuren', style: 'door' },
    ],
    lightSuggestions: [
      { key: 'hanglamp',     label: 'Hanglamp eettafel', x: 360, y: 130 },
      { key: 'spots',        label: 'Spots plafond',     x: 640, y: 110 },
      { key: 'keuken_lamp',  label: 'Lamp keukeneiland', x: 615, y: 360 },
    ],
    lightPlacements: [],
  },
];
