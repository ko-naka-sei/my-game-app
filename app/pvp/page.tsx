'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// 🎴 マスターデッキ（ここで配られるカードが決まります！）
const MASTER_DECK = [
  // ★ここにスロットを追加しました！
  { id: 'slot-1', name: '運命のスロット', val: 0, cost: 0, type: 'skill', desc: '777で即死、💀で破滅' },
  
  // 通常カード
  { id: 'atk-1', name: 'ストライク', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
  { id: 'atk-2', name: 'ストライク', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
  { id: 'atk-3', name: 'ストライク', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
  { id: 'atk-4', name: '強打', val: 12, cost: 2, type: 'attack', desc: '12ダメージ' },
  { id: 'def-1', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
  { id: 'def-2', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
  { id: 'def-3', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
  { id: 'def-4', name: '鉄壁', val: 10, cost: 2, type: 'skill', desc: 'ブロック+10' },
];

export default function PvpLobby() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');

  // シャッフル関数
  const shuffle = (array: any[]) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  // 部屋を作る（P1）
  const createRoom = async () => {
    if (!roomId || !playerName) return alert('部屋IDと名前を入力してください');

    // 1. デッキを作ってシャッフル
    const p1DeckFull = shuffle([...MASTER_DECK]);
    const p2DeckFull = shuffle([...MASTER_DECK]);

    // 2. 最初の5枚を手札にする
    const p1Hand = p1DeckFull.splice(0, 5);
    const p2Hand = p2DeckFull.splice(0, 5);

    // 3. 初期データ作成 (必殺ゲージ special も0で初期化！)
    const initialState = {
      turn: 'p1', 
      last_action: 'ゲーム開始',
      
      // Player 1
      p1_hp: 50, p1_energy: 3, p1_block: 0, p1_special: 0,
      p1_deck: p1DeckFull, p1_hand: p1Hand, p1_discard: [],
      
      // Player 2
      p2_hp: 50, p2_energy: 3, p2_block: 0, p2_special: 0,
      p2_deck: p2DeckFull, p2_hand: p2Hand, p2_discard: [],
    };

    // DBに保存 (as anyで型エラー回避)
    const { error } = await (supabase.from('battle_room') as any).insert({
      id: roomId,
      player1: playerName,
      boardState: initialState
    });

    if (error) alert('エラー: ' + error.message);
    else router.push(`/pvp/${roomId}?player=p1&name=${playerName}`);
  };

  // 部屋に参加する（P2）
  const joinRoom = async () => {
    if (!roomId || !playerName) return alert('部屋IDと名前を入力してください');

    const { error } = await (supabase.from('battle_room') as any)
      .update({ player2: playerName }) 
      .eq('id', roomId);

    if (error) alert('部屋が見つかりません');
    else router.push(`/pvp/${roomId}?player=p2&name=${playerName}`);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8 text-yellow-500 animate-pulse">⚡ SLAY THE SLOT</h1>
      
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md flex flex-col gap-4 border border-gray-700">
        <label className="text-sm text-gray-400">プレイヤー名</label>
        <input 
          type="text" 
          placeholder="例: 勇者タカシ"
          value={playerName} 
          onChange={(e) => setPlayerName(e.target.value)}
          className="p-3 rounded bg-gray-700 text-white font-bold border border-gray-600 focus:outline-none focus:border-yellow-500"
        />
        
        <label className="text-sm text-gray-400">部屋ID (数字4桁など)</label>
        <input 
          type="text" 
          placeholder="例: 7777"
          value={roomId} 
          onChange={(e) => setRoomId(e.target.value)}
          className="p-3 rounded bg-gray-700 text-white font-bold border border-gray-600 focus:outline-none focus:border-yellow-500"
        />
        
        <div className="flex gap-4 mt-6">
          <button onClick={createRoom} className="flex-1 bg-blue-600 py-4 rounded-lg font-bold hover:bg-blue-500 transition shadow-lg">
            部屋を作る (P1)
          </button>
          <button onClick={joinRoom} className="flex-1 bg-green-600 py-4 rounded-lg font-bold hover:bg-green-500 transition shadow-lg">
            参加する (P2)
          </button>
        </div>
      </div>
    </div>
  );
}