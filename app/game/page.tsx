// app/game/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, Enemy, Player } from '@/types/game';
import { INITIAL_DECK, ENEMIES } from '@/lib/game-data';

export default function GamePage() {
  // --- ステート管理 ---
  const [player, setPlayer] = useState<Player>({ hp: 50, maxHp: 50, energy: 3, maxEnergy: 3, block: 0 });
  const [enemy, setEnemy] = useState<Enemy>(ENEMIES[0]); // 最初はスライム
  
  // デッキ管理
  const [drawPile, setDrawPile] = useState<Card[]>([]);
  const [hand, setHand] = useState<Card[]>([]);
  const [discardPile, setDiscardPile] = useState<Card[]>([]);
  
  const [log, setLog] = useState<string[]>(['戦闘開始！']);
  const [gameOver, setGameOver] = useState<'win' | 'lose' | null>(null);

  // --- 初期化 ---
  useEffect(() => {
    startBattle();
  }, []);

  const startBattle = () => {
    // デッキをシャッフルしてセット
    const shuffled = [...INITIAL_DECK].sort(() => Math.random() - 0.5);
    setDrawPile(shuffled);
    setHand([]);
    setDiscardPile([]);
    setPlayer({ hp: 50, maxHp: 50, energy: 3, maxEnergy: 3, block: 0 });
    setEnemy(ENEMIES[0]);
    setGameOver(null);
    setLog(['戦闘開始！']);
    
    // 最初のドローは少し遅らせて実行（ステート反映待ち）
    setTimeout(() => drawCards(shuffled, [], 5), 100);
  };

  // --- カードドロー処理 ---
  const drawCards = (currentDraw: Card[], currentDiscard: Card[], count: number) => {
    let newDraw = [...currentDraw];
    let newDiscard = [...currentDiscard];
    let newHand: Card[] = [];

    for (let i = 0; i < count; i++) {
      if (newDraw.length === 0) {
        if (newDiscard.length === 0) break; // 引くカードがない
        // 捨て札をシャッフルして山札に戻す
        newDraw = [...newDiscard].sort(() => Math.random() - 0.5);
        newDiscard = [];
        addLog('捨て札を山札に戻した！');
      }
      const card = newDraw.pop();
      if (card) newHand.push(card);
    }

    setDrawPile(newDraw);
    setDiscardPile(newDiscard);
    setHand((prev) => [...prev, ...newHand]);
  };

  // --- ログ追加ヘルパー ---
  const addLog = (msg: string) => {
    setLog((prev) => [msg, ...prev].slice(0, 5)); // 最新5件のみ表示
  };

  // --- プレイヤーのカード使用 ---
  const playCard = (card: Card, index: number) => {
    if (gameOver) return;
    if (player.energy < card.cost) {
      addLog('⚠️ エナジーが足りない！');
      return;
    }

    // コスト支払い
    setPlayer((prev) => ({ ...prev, energy: prev.energy - card.cost }));

    // 効果発動
    if (card.type === 'attack') {
      let damage = card.value;
      // 敵へのダメージ処理
      setEnemy((prev) => {
        const newHp = prev.hp - damage;
        if (newHp <= 0) handleWin();
        return { ...prev, hp: Math.max(0, newHp) };
      });
      addLog(`⚔️ ${card.name}！敵に${damage}ダメージ！`);
    } else if (card.type === 'skill') {
      setPlayer((prev) => ({ ...prev, block: prev.block + card.value }));
      addLog(`🛡️ ${card.name}！ブロック+${card.value}`);
    }

    // 手札から捨て札へ移動
    const newHand = [...hand];
    newHand.splice(index, 1);
    setHand(newHand);
    setDiscardPile((prev) => [...prev, card]);
  };

  // --- 勝利処理 ---
  const handleWin = () => {
    setGameOver('win');
    addLog('🎉 敵を倒した！勝利！');
  };

  // --- ターン終了（敵の行動） ---
  const endTurn = () => {
    if (gameOver) return;

    // 1. 手札をすべて捨て札へ
    setDiscardPile((prev) => [...prev, ...hand]);
    setHand([]);

    addLog('--- 敵のターン ---');

    // 2. 敵の行動実行
    setTimeout(() => {
      let damage = 0;
      
      // 敵の行動パターン分岐
      if (enemy.intent === 'attack') {
        damage = enemy.intentValue;
        
        // ブロックで軽減
        let actualDamage = damage;
        if (player.block > 0) {
          if (player.block >= damage) {
            actualDamage = 0;
            addLog(`🛡️ 敵の攻撃(${damage})を完全に防いだ！`);
          } else {
            actualDamage = damage - player.block;
            addLog(`🛡️ ブロックで軽減！ ${damage} -> ${actualDamage}ダメージ`);
          }
        } else {
          addLog(`💥 ${damage}のダメージを受けた！`);
        }

        setPlayer((prev) => {
          const newHp = prev.hp - actualDamage;
          if (newHp <= 0) {
            setGameOver('lose');
            addLog('💀 敗北した...');
          }
          return { ...prev, hp: Math.max(0, newHp), block: 0 }; // ターン終了でブロックは消える
        });
      } else if (enemy.intent === 'charge') {
        addLog('⚠️ 敵が力を溜めている...');
        setEnemy(prev => ({ ...prev, intent: 'attack', intentValue: 15 })); // 次ターン強力攻撃
      }

      // 3. 次の敵の行動を決定（ランダム）
      if (!gameOver) {
        const nextIntent = Math.random() > 0.4 ? 'attack' : 'charge';
        const nextValue = nextIntent === 'attack' ? Math.floor(Math.random() * 5) + 6 : 0;
        
        setEnemy((prev) => ({
          ...prev,
          intent: nextIntent === 'attack' ? 'attack' : 'charge',
          intentValue: nextValue
        }));

        // 4. プレイヤーのターン準備
        setTimeout(() => {
          setPlayer((prev) => ({ ...prev, energy: prev.maxEnergy })); // エナジー全回復
          drawCards(drawPile, discardPile, 5); // 5枚ドロー
          addLog('--- あなたのターン ---');
        }, 1000);
      }
    }, 1000);
  };

  // --- UIコンポーネント ---
  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans overflow-hidden flex flex-col">
      
      {/* 1. ヘッダー（山札・捨て札情報など） */}
      <div className="p-4 flex justify-between bg-gray-800 border-b border-gray-700">
        <div>Deck: {drawPile.length} | Discard: {discardPile.length}</div>
        <Link href="/" className="text-gray-400 hover:text-white">Exit</Link>
      </div>

      {/* 2. バトルフィールド（敵エリア） */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        {gameOver && (
          <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center">
            <h2 className={`text-6xl font-bold mb-4 ${gameOver === 'win' ? 'text-yellow-400' : 'text-red-600'}`}>
              {gameOver === 'win' ? 'VICTORY!' : 'DEFEAT'}
            </h2>
            <button onClick={startBattle} className="px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200">
              もう一度遊ぶ
            </button>
          </div>
        )}

        {/* 敵のインテント */}
        <div className="mb-4 bg-gray-800 px-4 py-2 rounded-full border border-red-500 animate-pulse">
          {enemy.intent === 'attack' ? `⚔️ ${enemy.intentValue} ダメージ攻撃予定` : '⚠️ 力を溜めている...'}
        </div>

        {/* 敵キャラ */}
        <div className={`w-40 h-40 bg-purple-600 rounded-xl shadow-[0_0_20px_rgba(147,51,234,0.5)] flex items-center justify-center text-6xl mb-2 transition-transform ${gameOver === 'win' ? 'scale-0 opacity-0' : 'animate-bounce'}`}>
          👾
        </div>
        <div className="text-xl font-bold">{enemy.name}</div>
        
        {/* 敵HPバー */}
        <div className="w-64 h-4 bg-gray-700 rounded-full mt-2 overflow-hidden border border-gray-500">
          <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}></div>
        </div>
        <div className="text-sm mt-1">{enemy.hp} / {enemy.maxHp} HP</div>
      </div>

      {/* 3. ログエリア */}
      <div className="h-32 bg-black/30 p-4 overflow-y-auto text-sm space-y-1 border-t border-gray-700">
        {log.map((l, i) => (
          <div key={i} className="text-gray-300 border-l-2 border-gray-500 pl-2">{l}</div>
        ))}
      </div>

      {/* 4. プレイヤーエリア（手札・ステータス） */}
      <div className="bg-gray-800 p-4 pb-8 border-t border-gray-700">
        {/* ステータスバー */}
        <div className="flex justify-center gap-8 mb-4">
          <div className="flex items-center gap-2">
            <div className="text-red-400 font-bold">HP</div>
            <div className="text-2xl font-bold">{player.hp}/{player.maxHp}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-blue-400 font-bold">Block</div>
            <div className="text-2xl font-bold">🛡️ {player.block}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-yellow-400 font-bold">Energy</div>
            <div className="flex gap-1">
              {[...Array(player.maxEnergy)].map((_, i) => (
                <div key={i} className={`w-6 h-6 rounded-full border-2 border-yellow-500 ${i < player.energy ? 'bg-yellow-400' : 'bg-transparent'}`}></div>
              ))}
            </div>
          </div>
          <button 
            onClick={endTurn} 
            disabled={!!gameOver}
            className="ml-8 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white font-bold py-2 px-6 rounded shadow-lg active:translate-y-1 transition-all"
          >
            ターン終了
          </button>
        </div>

        {/* 手札リスト */}
        <div className="flex justify-center gap-3 h-48 items-end">
          {hand.map((card, index) => (
            <div 
              key={`${card.id}-${index}`}
              onClick={() => playCard(card, index)}
              className={`
                relative w-32 h-44 bg-gray-700 rounded-xl border-2 p-3 cursor-pointer transition-all hover:-translate-y-6 hover:z-10 shadow-xl flex flex-col justify-between
                ${card.type === 'attack' ? 'border-red-500 hover:shadow-red-900/50' : 'border-blue-500 hover:shadow-blue-900/50'}
                ${player.energy < card.cost ? 'opacity-50 grayscale cursor-not-allowed' : ''}
              `}
            >
              <div className="absolute -top-3 -left-3 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold border-2 border-white shadow">
                {card.cost}
              </div>
              <div className="text-center font-bold text-sm mt-2">{card.name}</div>
              <div className="text-xs text-gray-300 text-center bg-black/20 p-1 rounded grow flex items-center justify-center my-2">
                {card.description}
              </div>
              <div className="text-[10px] text-center text-gray-400 uppercase">{card.type}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}