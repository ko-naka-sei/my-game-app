'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function PvpLobby() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');

  // 部屋を作る（自分がPlayer1になる）
  const createRoom = async () => {
    if (!roomId || !playerName) return alert('部屋IDと名前を入力してください');

    // 初期状態（HPなど）を定義
    const initialState = {
      p1_hp: 50, p2_hp: 50,
      turn: 'p1', // p1のターンから開始
      last_action: 'ゲーム開始'
    };

// ★ (supabase.from(...) as any) を使ってエラー回避
    const { error } = await (supabase.from('battle_room') as any).insert({
      id: roomId,
      player1: playerName,
      boardState: initialState
    });

    if (error) alert('エラー: ' + error.message);
    else router.push(`/pvp/${roomId}?player=p1&name=${playerName}`);
  };

  // 部屋に入る（自分がPlayer2になる）
  const joinRoom = async () => {
    if (!roomId || !playerName) return alert('部屋IDと名前を入力してください');

    const { error } = await supabase.from('battle_room')
      .update({ player2: playerName }) // Player2として参加
      .eq('id', roomId);

    if (error) alert('部屋が見つかりません');
    else router.push(`/pvp/${roomId}?player=p2&name=${playerName}`);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8 text-red-500">🔥 オンライン対戦ロビー</h1>
      
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md flex flex-col gap-4">
        <input 
          type="text" placeholder="プレイヤー名（例: タカシ）"
          value={playerName} onChange={(e) => setPlayerName(e.target.value)}
          className="p-3 rounded text-black font-bold"
        />
        <input 
          type="text" placeholder="部屋ID（数字4桁など）"
          value={roomId} onChange={(e) => setRoomId(e.target.value)}
          className="p-3 rounded text-black font-bold"
        />
        
        <div className="flex gap-4 mt-4">
          <button onClick={createRoom} className="flex-1 bg-blue-600 py-3 rounded font-bold hover:bg-blue-500">
            部屋を作る (P1)
          </button>
          <button onClick={joinRoom} className="flex-1 bg-green-600 py-3 rounded font-bold hover:bg-green-500">
            参加する (P2)
          </button>
        </div>
      </div>
    </div>
  );
}