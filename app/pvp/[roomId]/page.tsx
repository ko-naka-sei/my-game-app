'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// カードデータ（仮）
const CARDS = [
  { id: 1, name: '剣撃', damage: 10, cost: 1 },
  { id: 2, name: '大剣', damage: 20, cost: 2 },
  { id: 3, name: '回復', damage: -15, cost: 1 },
  { id: 4, name: 'ファイア', damage: 30, cost: 3 },
];

export default function PvpBattle() {
  const { roomId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // URLから自分の情報を取得
  const myRole = searchParams.get('player'); // "p1" か "p2"
  const myName = searchParams.get('name');

  const [board, setBoard] = useState<any>(null);
  const [result, setResult] = useState<'win' | 'lose' | null>(null);

  // 1. リアルタイム通信 & 決着監視
// 1. リアルタイム通信 & 決着監視
  useEffect(() => {
    // 初回読み込み
    const fetchInitial = async () => {
      // ★追加1: URLがないときは何もしない（エラー防止）
      if (!roomId) return;

      // ★追加2: "as string" をつけて「これは文字だよ」と教える
    const { data } = await supabase
        .from('battle_room')
        .select('*')
        .eq('id', roomId as string) 
        .single();

      // ★修正: (data as any) をつけて「型チェックを無視」させます
      if (data) setBoard((data as any).boardState);
    };
    fetchInitial();

    // 監視開始
    const channel = supabase.channel(`room-${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battle_room', filter: `id=eq.${roomId}` }, 
      (payload) => {
        const newState = payload.new.boardState;
        setBoard(newState);
        checkGameOver(newState); // 更新されるたびに勝敗チェック
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  // 2. 勝敗判定ロジック
  const checkGameOver = (state: any) => {
    if (!state) return;

    // P1の負け（P2の勝ち）
    if (state.p1_hp <= 0) {
      if (myRole === 'p1') handleDefeat();
      if (myRole === 'p2') handleVictory();
    }
    // P2の負け（P1の勝ち）
    else if (state.p2_hp <= 0) {
      if (myRole === 'p2') handleDefeat();
      if (myRole === 'p1') handleVictory();
    }
  };

  // 勝利処理（レートを上げる）
  const handleVictory = async () => {
    if (result) return; // すでに判定済みなら何もしない
    setResult('win');

    // ★ここで戦闘力を上げる！
    // ※本来はログインIDを使いますが、今回は簡易的に固定IDで実験
    // const { data: { user } } = await supabase.auth.getUser(); 
    // if(user) { ... }
    
    console.log('勝利！レート更新処理...');
    // 実験用: 勝ったら自動で「profile」テーブルを作る/更新する
    await supabase.from('profile').upsert({
      user_id: myName, // 名前をID代わりにしちゃいます（実験用）
      combatPower: 1020, // 本来は「今の値 + 20」にする
      name: myName
    }, { onConflict: 'user_id' });
  };

  // 敗北処理
  const handleDefeat = () => {
    if (result) return;
    setResult('lose');
  };

  // 3. カード使用処理
  const playCard = async (card: any) => {
    if (!board || result) return;
    if (board.turn !== myRole) return alert('相手のターンです！');

    let newP1Hp = board.p1_hp;
    let newP2Hp = board.p2_hp;
    const msg = `${myName}が「${card.name}」を使った！`;

    // ダメージ計算
    if (myRole === 'p1') {
      newP2Hp -= card.damage;
      if (card.damage < 0) { newP1Hp -= card.damage; newP2Hp += card.damage; }
    } else {
      newP1Hp -= card.damage;
      if (card.damage < 0) { newP2Hp -= card.damage; newP1Hp += card.damage; }
    }

    // DB更新
    await supabase.from('battle_room').update({
      boardState: {
        ...board,
        p1_hp: newP1Hp,
        p2_hp: newP2Hp,
        turn: myRole === 'p1' ? 'p2' : 'p1',
        last_action: msg
      }
    }).eq('id', roomId);
  };

  if (!board) return <div className="text-white p-10">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col justify-between relative overflow-hidden">
      
      {/* --- 勝敗リザルト画面 (ポップアップ) --- */}
      {result && (
        <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
          <h1 className={`text-6xl font-black mb-4 ${result === 'win' ? 'text-yellow-400' : 'text-blue-600'}`}>
            {result === 'win' ? 'VICTORY' : 'DEFEAT'}
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            {result === 'win' ? '戦闘力が上がりました！ (+20)' : '残念...次は勝とう！'}
          </p>
          <button 
            onClick={() => router.push('/pvp')}
            className="px-8 py-3 bg-white text-black font-bold rounded hover:scale-105 transition"
          >
            ロビーに戻る
          </button>
        </div>
      )}

      {/* --- 敵エリア --- */}
      <div className="bg-red-900/20 p-4 rounded-xl border border-red-500/50 text-center transition-all">
        <div className="text-sm text-red-300 mb-1">ENEMY</div>
        <div className="text-5xl font-bold font-mono tracking-tighter">
          {myRole === 'p1' ? board.p2_hp : board.p1_hp}
        </div>
        {/* HPバー */}
        <div className="w-full h-2 bg-gray-800 rounded mt-2">
          <div 
            className="h-full bg-red-500 transition-all duration-500"
            style={{ width: `${Math.max(0, ((myRole === 'p1' ? board.p2_hp : board.p1_hp) / 50) * 100)}%` }}
          />
        </div>
      </div>

      {/* --- 実況ログ --- */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-yellow-400 font-bold text-xl mb-2 animate-pulse">{board.last_action}</div>
          <div className={`text-sm px-3 py-1 rounded-full inline-block ${board.turn === myRole ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
            {board.turn === myRole ? 'あなたのターン' : '相手のターン...'}
          </div>
        </div>
      </div>

      {/* --- 自分エリア --- */}
      <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-500/50">
        <div className="flex justify-between items-end mb-4 px-2">
          <div>
            <div className="text-sm text-blue-300">YOU ({myName})</div>
            <div className="text-4xl font-bold font-mono">
              {myRole === 'p1' ? board.p1_hp : board.p2_hp}
            </div>
          </div>
        </div>

        {/* 手札リスト */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {CARDS.map((card) => (
            <button
              key={card.id}
              onClick={() => playCard(card)}
              disabled={board.turn !== myRole}
              className={`
                flex-shrink-0 w-24 h-32 rounded-lg border-2 flex flex-col items-center justify-center p-2 transition-all relative
                ${board.turn === myRole 
                  ? 'bg-gray-800 border-yellow-500 hover:-translate-y-2 hover:shadow-[0_0_15px_rgba(234,179,8,0.5)]' 
                  : 'bg-gray-900 border-gray-700 opacity-50 cursor-not-allowed'}
              `}
            >
              <div className="font-bold text-sm mb-1">{card.name}</div>
              <div className="text-2xl font-black">{card.damage > 0 ? card.damage : '💚'}</div>
              <div className="absolute top-1 left-1 text-[10px] bg-blue-600 px-1 rounded">{card.cost}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}