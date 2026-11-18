// Gedeelde constanten voor de hele game.
export const CELL = 2; // grootte van één gridcel in wereld-eenheden
export const WALL_H = 4; // muren ruim boven ooghoogte: je kijkt er niet overheen
export const EYE_H = 1.6;
export const PLAYER_RADIUS = 0.45;
export const PLAYER_SPEED = 4.6; // eenheden per seconde
export const MONSTER_BASE_SPEED = 3.4;
export const START_LIVES = 3;

export const POINTS = {
  pellet: 10,
  power: 50,
  monster: 200,
  fakePower: -100,
};

export const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
