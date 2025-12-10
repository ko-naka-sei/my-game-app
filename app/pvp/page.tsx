'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const MASTER_DECK = [
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

  const shuffle = (array: any[]) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  const createRoom = async () => {
    if (!roomId || !playerName) return alert('部屋IDと名前を入力してください');

    const p1DeckFull = shuffle([...MASTER_DECK]);
    const p2DeckFull = shuffle([...MASTER_DECK]);

    const initialState = {
      turn: 'p1', last_action: 'ゲーム開始',
      // ★追加：p1_special, p2_special (必殺ゲージ)
      p1_hp: 100, p1_energy: 3, p1_block: 0, p1_special: 0,
      p1_deck: p1DeckFull, p1_hand: p1DeckFull.splice(0, 5), p1_discard: [],
      
      p2_hp: 100, p2_energy: 3, p2_block: 0, p2_special: 0,
      p2_deck: p2DeckFull, p2_hand: p2DeckFull.splice(0, 5), p2_discard: [],
    };

    const { error } = await (supabase.from('battle_room') as any).insert({
      id: roomId, player1: playerName, boardState: initialState
    });

    if (error) alert('エラー: ' + error.message);
    else router.push(`/pvp/${roomId}?player=p1&name=${playerName}`);
  };

  const joinRoom = async () => {
    if (!roomId || !playerName) return alert('部屋IDと名前を入力してください');
    const { error } = await (supabase.from('battle_room') as any)
      .update({ player2: playerName }).eq('id', roomId);
    if (error) alert('部屋が見つかりません');
    else router.push(`/pvp/${roomId}?player=p2&name=${playerName}`);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8 text-purple-500">⚡ 必殺技バトル</h1>
      <div className="bg-gray-800 p-8 rounded-lg w-full max-w-md flex flex-col gap-4">
        <input type="text" placeholder="プレイヤー名" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="p-3 rounded text-black font-bold" />
        <input type="text" placeholder="部屋ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} className="p-3 rounded text-black font-bold" />
        <div className="flex gap-4 mt-4">
          <button onClick={createRoom} className="flex-1 bg-blue-600 py-3 rounded font-bold">部屋を作る (P1)</button>
          <button onClick={joinRoom} className="flex-1 bg-green-600 py-3 rounded font-bold">参加する (P2)</button>
        </div>
      </div>
    </div>
  );
}