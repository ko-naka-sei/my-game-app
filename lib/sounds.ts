// lib/sounds.ts

// 音声ファイルのパスを定義（ファイル名を変えたらここも修正！）
export const SOUNDS = {
  ATTACK: '/sounds/attack.mp3',
  DEFENSE: '/sounds/defense.mp3',
  TURN: '/sounds/turn.mp3',
} as const;

// 音を鳴らす関数
export const playSound = (path: string) => {
  // サーバー側(Node.js)では実行しないようにガード
  if (typeof window === 'undefined') return;

  try {
    const audio = new Audio(path);
    audio.volume = 0.5; // 音量 (0.0〜1.0)
    audio.play().catch(e => console.log('サウンド再生エラー(ブラウザ設定かも):', e));
  } catch (err) {
    console.error('Sound error:', err);
  }
};