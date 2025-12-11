'use client';
import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function PvpLobbyContent() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [isSearching, setIsSearching] = useState(false); // ★検索中フラグ

  // --- 共通: 部屋作成ロジック ---
  const createRoomLogic = async (targetId: string) => {
    const initialState = {
      phase: 'select_deck',
      status: 'input',
      round: 1,
      last_result: 'デッキを選んでください',
      p1_name: playerName, p1_role: null, p1_hp: 3, p1_hand: [], p1_card: null,
      p2_name: 'Waiting...', p2_role: null, p2_hp: 3, p2_hand: [], p2_card: null,
    };
    const { error } = await (supabase.from('battle_room') as any).insert({
      id: targetId, player1: playerName, boardState: initialState
    });
    if (error) {
      if (isSearching) return false; // ランダムマッチなら失敗として扱う
      alert('エラー: ' + error.message);
    } else {
      router.push(`/pvp/${targetId}?player=p1&name=${playerName}`);
    }
    return true;
  };

  // --- 共通: 部屋参加ロジック ---
  const joinRoomLogic = async (targetId: string) => {
    const { error } = await (supabase.from('battle_room') as any).update({ player2: playerName }).eq('id', targetId);
    if (error) return false;

    const { data } = await (supabase.from('battle_room') as any).select('boardState').eq('id', targetId).single();
    if(data) {
       const newState = data.boardState;
       newState.p2_name = playerName;
       await (supabase.from('battle_room') as any).update({ boardState: newState }).eq('id', targetId);
       router.push(`/pvp/${targetId}?player=p2&name=${playerName}`);
       return true;
    }
    return false;
  };

  // --- 手動作成 ---
  const createRoom = () => {
    if (!playerName || !roomId) return alert('入力してください');
    createRoomLogic(roomId);
  };

  // --- 手動参加 ---
  const joinRoom = async () => {
    if (!playerName || !roomId) return alert('入力してください');
    const success = await joinRoomLogic(roomId);
    if (!success) alert('部屋が見つかりません');
  };

  // --- ★ランダム対戦機能 ---
  const handleRandomMatch = async () => {
    if (!playerName) return alert('名前を入力してください');
    setIsSearching(true);

    try {
      // 1時間以内に作られた待機部屋を探す
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString(); 
      const { data: waitingRooms } = await (supabase.from('battle_room') as any)
        .select('*')
        .is('player2', null) // 誰も入ってない
        .gt('updatedAt', oneHourAgo)
        .order('updatedAt', { ascending: false })
        .limit(1);

      if (waitingRooms && waitingRooms.length > 0) {
        // 部屋があれば参加
        console.log('部屋発見:', waitingRooms[0].id);
        await joinRoomLogic(waitingRooms[0].id);
      } else {
        // なければ作成 (ランダムID)
        const randomId = Math.random().toString(36).substring(2, 8);
        console.log('部屋作成:', randomId);
        await createRoomLogic(randomId);
      }
    } catch (e) {
      alert('マッチングエラー');
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 font-sans relative">
      
      {/* ルールモーダル (省略せず記述) */}
      {showRules && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setShowRules(false)}>
          <div className="bg-gray-900 border-2 border-yellow-600 p-6 rounded-xl max-w-lg w-full shadow-2xl relative overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowRules(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">✕</button>
            <h2 className="text-3xl font-black text-yellow-500 mb-6 text-center border-b border-gray-700 pb-2">📜 ルールブック</h2>
            <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
              <section>
                <h3 className="text-lg font-bold text-white mb-2">1. 3すくみの力関係</h3>
                <div className="flex justify-around items-center bg-black/50 p-4 rounded-lg">
                  <div className="text-center"><div className="text-4xl">👑</div><div className="text-yellow-500 font-bold">皇帝</div></div>
                  <div className="text-2xl text-gray-500">＞</div>
                  <div className="text-center"><div className="text-4xl">🖐</div><div className="text-blue-400 font-bold">市民</div></div>
                  <div className="text-2xl text-gray-500">＞</div>
                  <div className="text-center"><div className="text-4xl">⛓️</div><div className="text-red-500 font-bold">奴隷</div></div>
                </div>
                <p className="mt-2 text-center text-red-400 font-bold animate-pulse">⚠️ ただし「奴隷」は「皇帝」を倒せる！(下克上)</p>
              </section>
              <section>
                <h3 className="text-lg font-bold text-white mb-2">3. 決着条件</h3>
                <p>ライフ(HP)は3つ。先に0になった方の負け。</p>
                <ul className="list-disc pl-5 mt-2">
                  <li>通常の勝利：<span className="text-white font-bold">1ダメージ</span></li>
                  <li>奴隷での勝利：<span className="text-red-500 font-bold">3ダメージ (即死)</span></li>
                  <li>あいこ：<span className="text-gray-400 font-bold">ダメージなし</span></li>
                </ul>
              </section>
            </div>
            <button onClick={() => setShowRules(false)} className="w-full mt-8 py-3 bg-yellow-700 hover:bg-yellow-600 text-white font-bold rounded">閉じる</button>
          </div>
        </div>
      )}

      <h1 className="text-6xl font-black mb-2 text-red-600 tracking-tighter animate-pulse">PSYCHO JANKEN</h1>
      <p className="text-gray-400 mb-8">皇帝か、奴隷か。命を賭けた4枚のカード。</p>

      <div className="bg-gray-900 p-8 rounded-xl border-2 border-red-800 w-full max-w-md shadow-2xl flex flex-col gap-4">
        <div>
          <label className="text-xs text-gray-500">PLAYER NAME</label>
          <input type="text" placeholder="名前" value={playerName} onChange={(e) => setPlayerName(e.target.value)} 
            className="w-full p-4 bg-black border border-gray-700 rounded text-xl font-bold focus:border-red-500 outline-none" />
        </div>

        {/* ★ランダムマッチボタン */}
        <button 
          onClick={handleRandomMatch} 
          disabled={isSearching}
          className="w-full py-4 bg-gradient-to-r from-red-800 to-yellow-700 rounded font-black text-xl shadow-lg hover:scale-105 transition active:scale-95 disabled:opacity-50 text-white border border-yellow-500/50"
        >
          {isSearching ? '🔍 対戦相手を探しています...' : '⚔️ ランダム対戦 (マッチング)'}
        </button>

        <div className="text-center text-gray-500 text-xs">- OR 指定した部屋に入る -</div>

        <div className="flex gap-2">
          <input type="text" placeholder="部屋ID (数字4桁)" value={roomId} onChange={(e) => setRoomId(e.target.value)} 
            className="flex-1 p-3 bg-black border border-gray-700 rounded font-bold outline-none" />
          <button onClick={createRoom} className="bg-gray-700 px-4 rounded font-bold hover:bg-gray-600">作成</button>
          <button onClick={joinRoom} className="bg-gray-700 px-4 rounded font-bold hover:bg-gray-600">参加</button>
        </div>

        <button onClick={() => setShowRules(true)} className="w-full py-2 text-gray-400 hover:text-white text-sm border border-gray-700 rounded mt-2">
          📖 ルールを確認する
        </button>
      </div>
    </div>
  );
}

export default function PvpLobby() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-red-600 flex items-center justify-center">Loading...</div>}>
      <PvpLobbyContent />
    </Suspense>
  );
}