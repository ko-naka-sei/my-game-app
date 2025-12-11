'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function PvpBattleContent() {
  const { roomId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const myRole = searchParams.get('player'); 
  const myName = searchParams.get('name');
  
  const [board, setBoard] = useState<any>(null);
  const [result, setResult] = useState<'win' | 'lose' | null>(null);
  const [mySelectedCard, setMySelectedCard] = useState<any>(null);
  const [showRules, setShowRules] = useState(false);
  const [flash, setFlash] = useState(false);

  // ---------------------------------------------------------
  // ヘルパー関数
  // ---------------------------------------------------------
  const updateBoard = async (newState: any) => {
    await (supabase.from('battle_room') as any).update({ boardState: newState }).eq('id', roomId);
  };

  const goBackToLobby = () => { window.location.href = '/pvp'; };

  // カード生成ロジック (再利用するため外に出す)
  const generateDeck = (role: 'emperor' | 'slave') => {
    const base = [
      { id: `r-${Date.now()}-${Math.random()}`, name: '✊ グー', type: 'rock', power: 1 },
      { id: `s-${Date.now()}-${Math.random()}`, name: '✌️ チョキ', type: 'scissors', power: 1 },
      { id: `p-${Date.now()}-${Math.random()}`, name: '✋ パー', type: 'paper', power: 1 },
    ];
    const special = role === 'emperor' 
      ? { id: 'emp', name: '👑 皇帝', type: 'emperor', power: 999 }
      : { id: 'slv', name: '⛓️ 奴隷', type: 'slave', power: 0 };
    return [...base, special];
  };

  // ---------------------------------------------------------
  // ★重要: 勝敗解決ロジック (カード補充機能を追加)
  // ---------------------------------------------------------
  const resolveRound = async () => {
    const { data } = await (supabase.from('battle_room') as any).select('boardState').eq('id', roomId).single();
    if (!data) return;
    let state = data.boardState;

    if (state.status === 'input') return;

    const c1 = state.p1_card;
    const c2 = state.p2_card;
    let log = '';
    let winner = 'draw'; 

    // 勝敗判定
    if (c1.type === 'slave' && c2.type === 'emperor') { winner = 'p1'; log = '‼️下克上(奴隷勝利)'; }
    else if (c1.type === 'emperor' && c2.type === 'slave') { winner = 'p2'; log = '‼️下克上(奴隷勝利)'; }
    else if (c1.type === 'emperor' && c2.type !== 'emperor') { winner = 'p1'; log = '皇帝の威圧'; }
    else if (c2.type === 'emperor' && c1.type !== 'emperor') { winner = 'p2'; log = '皇帝の威圧'; }
    else if (c1.type === 'slave' && c2.type !== 'slave') { winner = 'p2'; log = '奴隷の敗北...'; }
    else if (c2.type === 'slave' && c1.type !== 'slave') { winner = 'p1'; log = '奴隷の敗北...'; }
    else if (c1.type === c2.type) { winner = 'draw'; log = '互角...'; }
    else {
      // じゃんけん
      if (
        (c1.type === 'rock' && c2.type === 'scissors') ||
        (c1.type === 'scissors' && c2.type === 'paper') ||
        (c1.type === 'paper' && c2.type === 'rock')
      ) winner = 'p1';
      else winner = 'p2';
    }

    // ダメージ計算
    let damage = 1;
    const isGekokujo = (c1.type === 'slave' && c2.type === 'emperor') || (c2.type === 'slave' && c1.type === 'emperor');
    if (isGekokujo) damage = 3;

    if (winner === 'p1') {
      state.p2_hp -= damage;
      state.last_result = `P1 WIN! ${log}`;
    } else if (winner === 'p2') {
      state.p1_hp -= damage;
      state.last_result = `P2 WIN! ${log}`;
    } else {
      state.last_result = 'DRAW...';
    }

    // リセット
    state.p1_card = null;
    state.p2_card = null;
    state.status = 'input'; 

    // ★重要追加: 手札が尽きて、かつ決着がついていない場合、カードを補充する
    const isGameOver = state.p1_hp <= 0 || state.p2_hp <= 0;
    
    if (!isGameOver && state.p1_hand.length === 0 && state.p2_hand.length === 0) {
      // 第2ラウンドへ！
      state.round = (state.round || 1) + 1;
      state.last_result = `決着つかず... ROUND ${state.round} 開始！`;
      
      // デッキ再配布 (それぞれの役割に基づいて生成)
      state.p1_hand = generateDeck(state.p1_role);
      state.p2_hand = generateDeck(state.p2_role);
    }
    
    await updateBoard(state);
  };

  // ---------------------------------------------------------
  // リアルタイム受信
  // ---------------------------------------------------------
  useEffect(() => {
    const fetchInitial = async () => {
      if (!roomId) return;
      const { data } = await (supabase.from('battle_room') as any).select('*').eq('id', roomId as string).single();
      if (data) setBoard(data.boardState);
    };
    fetchInitial();

    const channel = supabase.channel(`room-${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battle_room', filter: `id=eq.${roomId}` }, 
      (payload) => {
        const newState = (payload.new as any).boardState;
        setBoard(newState);

        if (newState.status === 'showdown' && myRole === 'p1') {
           setTimeout(() => {
             resolveRound();
           }, 4000); 
        }

        if (newState.status === 'input') {
          if (newState.p1_hp <= 0) { if(myRole==='p1') setResult('lose'); else setResult('win'); }
          else if (newState.p2_hp <= 0) { if(myRole==='p2') setResult('lose'); else setResult('win'); }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, myRole]);

  // ---------------------------------------------------------
  // アクション
  // ---------------------------------------------------------
  const submitCard = async () => {
    if (!mySelectedCard || !board) return;
    const { data } = await (supabase.from('battle_room') as any).select('boardState').eq('id', roomId).single();
    if (!data) return;
    let nextState = data.boardState;
    const prefix = myRole === 'p1' ? 'p1' : 'p2';

    if (nextState[`${prefix}_card`]) return; 

    nextState[`${prefix}_card`] = mySelectedCard;
    nextState[`${prefix}_hand`] = nextState[`${prefix}_hand`].filter((c:any) => c.id !== mySelectedCard.id);

    if (nextState.p1_card && nextState.p2_card) {
       nextState.status = 'showdown';
       nextState.last_result = 'OPEN!!';
    } else {
       nextState.last_result = `${myName}がセット完了...`;
    }
    
    await updateBoard(nextState);
    setMySelectedCard(null);
  };

  const selectDeck = async (role: 'emperor' | 'slave') => {
    if (!board) return;
    const { data } = await (supabase.from('battle_room') as any).select('boardState').eq('id', roomId).single();
    if (!data) return;
    let nextState = data.boardState;
    const prefix = myRole === 'p1' ? 'p1' : 'p2';

    if (nextState[`${prefix}_role`]) return;

    nextState[`${prefix}_role`] = role;
    nextState[`${prefix}_hand`] = generateDeck(role);

    if (nextState.p1_role && nextState.p2_role) {
      nextState.phase = 'battle';
      nextState.last_result = 'カードを選択してください';
    } else {
      nextState.last_result = `${myName}が準備完了...`;
    }
    await updateBoard(nextState);
  };

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  if (!board) return <div className="bg-black text-red-600 p-10">LOADING...</div>;

  const prefix = myRole === 'p1' ? 'p1' : 'p2';
  const enemyPrefix = myRole === 'p1' ? 'p2' : 'p1';
  
  if (board.phase === 'select_deck' && !board[`${prefix}_role`]) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 gap-8">
        <h2 className="text-4xl font-bold animate-pulse">デッキを選択せよ</h2>
        <div className="flex gap-4 w-full max-w-lg">
          <button onClick={() => selectDeck('emperor')} className="flex-1 h-64 bg-yellow-900/50 border-4 border-yellow-600 rounded-xl flex flex-col items-center justify-center hover:bg-yellow-800/50 transition">
            <div className="text-6xl mb-4">👑</div>
            <div className="text-2xl font-black text-yellow-500">皇帝デッキ</div>
            <div className="text-xs text-gray-400 mt-2">最強だが奴隷に刺される</div>
          </button>
          <button onClick={() => selectDeck('slave')} className="flex-1 h-64 bg-blue-900/50 border-4 border-blue-600 rounded-xl flex flex-col items-center justify-center hover:bg-blue-800/50 transition">
            <div className="text-6xl mb-4">⛓️</div>
            <div className="text-2xl font-black text-blue-500">奴隷デッキ</div>
            <div className="text-xs text-gray-400 mt-2">最弱だが皇帝を殺せる</div>
          </button>
        </div>
      </div>
    );
  }
  if (board.phase === 'select_deck') return <div className="min-h-screen bg-black text-white flex items-center justify-center text-2xl animate-pulse">相手の選択を待っています...</div>;

  const myHand = board[`${prefix}_hand`] || [];
  const myLife = board[`${prefix}_hp`];
  const enemyLife = board[`${enemyPrefix}_hp`];
  const isShowdown = board.status === 'showdown';
  const enemyCardSet = board[`${enemyPrefix}_card`] !== null;
  const myCardSet = board[`${prefix}_card`] !== null;
  const enemyCardData = board[`${enemyPrefix}_card`];
  const myCardData = board[`${prefix}_card`];

  return (
    <div className={`min-h-screen bg-black text-white p-4 flex flex-col justify-between font-sans relative ${flash ? 'animate-flash' : ''}`}>
      
      {/* ルールボタン */}
      <button onClick={() => setShowRules(true)} className="absolute top-4 right-4 text-2xl text-gray-500 hover:text-white z-50">❓</button>

      {showRules && (
        <div className="absolute inset-0 bg-black/90 z-[10000] flex items-center justify-center p-4" onClick={() => setShowRules(false)}>
          <div className="bg-gray-900 border-2 border-yellow-600 p-6 rounded-xl max-w-lg w-full relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowRules(false)} className="absolute top-4 right-4 text-gray-400">✕</button>
            <h2 className="text-2xl font-black text-yellow-500 mb-4 text-center">📜 ルールブック</h2>
            <div className="space-y-4 text-gray-300 text-sm">
              <div><span className="text-yellow-500 font-bold">👑 皇帝</span> ＞ <span className="text-blue-400 font-bold">市民(✊✌️✋)</span> ＞ <span className="text-red-500 font-bold">⛓️ 奴隷</span></div>
              <div className="text-center text-red-400 font-bold border-t border-b border-gray-700 py-2">⚠️ 「奴隷」は「皇帝」を倒せる！(下克上)</div>
              <ul className="list-disc pl-5">
                <li>通常勝利：<span className="text-white font-bold">1ダメージ</span></li>
                <li>奴隷勝利：<span className="text-red-500 font-bold">3ダメージ (即死)</span></li>
                <li>あいこ：<span className="text-gray-400 font-bold">ダメージなし</span></li>
                <li>手札切れ：<span className="text-blue-300 font-bold">自動補充 (ROUND進行)</span></li>
              </ul>
            </div>
            <button onClick={() => setShowRules(false)} className="w-full mt-6 py-3 bg-yellow-700 hover:bg-yellow-600 text-white font-bold rounded">閉じる</button>
          </div>
        </div>
      )}

      {result && (
        <div className="absolute inset-0 bg-black/95 z-[9999] flex flex-col items-center justify-center animate-in fade-in">
          <h1 className={`text-8xl font-black mb-4 ${result === 'win' ? 'text-yellow-500' : 'text-gray-600'}`}>{result === 'win' ? 'WINNER' : 'LOSE...'}</h1>
          <button onClick={goBackToLobby} className="px-12 py-4 bg-red-700 text-white font-bold text-xl rounded hover:scale-105">TOPへ</button>
        </div>
      )}

      {/* 敵エリア */}
      <div className="flex flex-col items-center gap-2 mt-4">
        <div className="flex gap-2"> {[...Array(3)].map((_,i) => <div key={i} className={`w-6 h-6 rounded-full border-2 border-red-600 transition-all duration-500 ${i < enemyLife ? 'bg-red-600' : 'bg-transparent'}`} />)} </div>
        <div className="text-gray-500 text-sm">{board[`${enemyPrefix}_name`]} (role: ???)</div>
        <div className="flex gap-1 h-24 items-center">
          {board[`${enemyPrefix}_hand`]?.map((_:any, i:number) => (
            <div key={i} className="w-16 h-24 bg-gray-800 border-2 border-gray-600 rounded flex items-center justify-center text-2xl">🃏</div>
          ))}
        </div>
        <div className={`w-32 h-48 border-4 rounded-xl flex flex-col items-center justify-center transition-all duration-500 mt-4
          ${isShowdown ? 'bg-white text-black rotate-0 scale-110' : 
            enemyCardSet ? 'bg-red-900 border-red-500 animate-pulse shadow-[0_0_20px_red]' : 'bg-gray-900/50 border-gray-800 border-dashed'}`}>
          {isShowdown && enemyCardData ? (
            <>
              <div className="text-6xl">{enemyCardData.type==='emperor'?'👑':enemyCardData.type==='slave'?'⛓️':enemyCardData.type==='rock'?'✊':enemyCardData.type==='scissors'?'✌️':'✋'}</div>
              <div className="font-bold text-lg mt-2">{enemyCardData.name}</div>
            </>
          ) : (
            enemyCardSet ? <span className="text-4xl">❓</span> : <span className="text-xs text-gray-600">THINKING</span>
          )}
        </div>
      </div>

      {/* 中央 */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        {isShowdown && <div className="text-6xl font-black text-red-600 animate-ping absolute">VS</div>}
        <div className="text-2xl font-bold text-yellow-500 animate-bounce bg-black/50 px-4 py-2 rounded">{board.last_result}</div>
      </div>

      {/* 自分エリア */}
      <div className="flex flex-col items-center gap-4 mb-4">
        <div className="h-52 flex items-center justify-center">
           {myCardSet ? (
             <div className={`w-32 h-48 rounded-xl flex flex-col items-center justify-center transition-all duration-500 border-4
               ${isShowdown ? 'bg-white text-black scale-110 border-white' : 'bg-blue-900 border-blue-500 shadow-[0_0_20px_blue]'}`}>
               {myCardData && (
                 <>
                   <div className="text-6xl">{myCardData.type==='emperor'?'👑':myCardData.type==='slave'?'⛓️':myCardData.type==='rock'?'✊':myCardData.type==='scissors'?'✌️':'✋'}</div>
                   <div className="font-bold text-lg mt-2">{myCardData.name}</div>
                 </>
               )}
             </div>
           ) : mySelectedCard ? (
             <div className="flex flex-col items-center gap-2">
               <div className="w-32 h-48 bg-gray-800 border-2 border-white rounded-xl flex flex-col items-center justify-center p-2 text-center animate-pulse">
                 <div className="text-6xl mb-4">{mySelectedCard.type==='emperor'?'👑':mySelectedCard.type==='slave'?'⛓️':mySelectedCard.type==='rock'?'✊':mySelectedCard.type==='scissors'?'✌️':'✋'}</div>
                 <div className="font-bold text-lg">{mySelectedCard.name}</div>
               </div>
               <button onClick={submitCard} className="px-8 py-2 bg-red-600 text-white font-bold rounded shadow-lg hover:bg-red-500">決定</button>
               <button onClick={()=>setMySelectedCard(null)} className="text-xs text-gray-400 underline">やめる</button>
             </div>
           ) : <div className="text-gray-600 text-sm">カードを選んでください</div>}
        </div>

        <div className="flex gap-2 overflow-x-auto w-full justify-center px-4 pb-4">
          {myHand.map((card: any, index: number) => (
            <button key={`${card.id}-${index}`} onClick={() => !myCardSet && setMySelectedCard(card)} disabled={myCardSet}
              className={`flex-shrink-0 w-20 h-28 rounded-lg border-2 flex flex-col items-center justify-between p-2 transition-all hover:-translate-y-4
                ${card.type === 'emperor' ? 'bg-yellow-900 border-yellow-500 shadow-lg' : card.type === 'slave' ? 'bg-blue-900 border-blue-500 shadow-lg' : 'bg-gray-800 border-gray-600'}`}>
              <div className="text-3xl mt-2">{card.type==='emperor'?'👑':card.type==='slave'?'⛓️':card.type==='rock'?'✊':card.type==='scissors'?'✌️':'✋'}</div>
              <div className="font-bold text-xs text-center">{card.name}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-4 items-center text-sm text-gray-400">
          <div>YOU: {board[`${prefix}_name`]} (Deck: {board[`${prefix}_role`] === 'emperor' ? '👑' : '⛓️'})</div>
          <div className="flex gap-2">{[...Array(3)].map((_,i) => <div key={i} className={`w-6 h-6 rounded-full border-2 border-blue-600 transition-all duration-500 ${i < myLife ? 'bg-blue-600' : 'bg-transparent'}`} />)}</div>
        </div>
      </div>
    </div>
  );
}

export default function PvpBattle() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-red-600 flex items-center justify-center">Loading...</div>}>
      <PvpBattleContent />
    </Suspense>
  );
}