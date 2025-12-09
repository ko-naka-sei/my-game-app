// types/game.ts

export type CardType = 'attack' | 'skill' | 'power';

export type Card = {
  id: string;
  name: string;
  cost: number;
  type: CardType;
  value: number; // 攻撃力や防御値
  description: string;
};

export type Enemy = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  intent: 'attack' | 'block' | 'charge'; // 敵の次の行動
  intentValue: number; // 攻撃予定値など
};

export type Player = {
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  block: number;
};