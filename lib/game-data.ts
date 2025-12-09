// lib/game-data.ts
import { Card, Enemy } from '@/types/game';

// プレイヤーの初期デッキ
export const INITIAL_DECK: Card[] = [
  { id: 'strike-1', name: 'ストライク', cost: 1, type: 'attack', value: 6, description: '6ダメージ与える' },
  { id: 'strike-2', name: 'ストライク', cost: 1, type: 'attack', value: 6, description: '6ダメージ与える' },
  { id: 'strike-3', name: 'ストライク', cost: 1, type: 'attack', value: 6, description: '6ダメージ与える' },
  { id: 'defend-1', name: '防御', cost: 1, type: 'skill', value: 5, description: 'ブロックを5得る' },
  { id: 'defend-2', name: '防御', cost: 1, type: 'skill', value: 5, description: 'ブロックを5得る' },
  { id: 'bash-1', name: '強打', cost: 2, type: 'attack', value: 10, description: '10ダメージ与える' },
];

// 敵のリスト（ランダムに出現させる用）
export const ENEMIES: Enemy[] = [
  { id: 'slime', name: 'アシッドスライム', hp: 30, maxHp: 30, intent: 'attack', intentValue: 6 },
  { id: 'orc', name: 'オーク戦士', hp: 45, maxHp: 45, intent: 'charge', intentValue: 0 },
  { id: 'dragon', name: '幼ドラゴン', hp: 80, maxHp: 80, intent: 'attack', intentValue: 12 },
];