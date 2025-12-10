'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const shuffle = (array: any[]) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export default function PvpBattle() {
  const { roomId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const myRole = searchParams.get('player'); 
  const myName = searchParams.get('name');
  
  const [board, setBoard] = useState<any>(null);
  const [result, setResult] = useState<'win' | 'lose' | null>(null);

  // ★演出 & ミニゲーム用ステート
  const [shakeP1, setShakeP1] = useState(false);
  const [shakeP2, setShakeP2] = useState(false);
  const [showMiniGame, setShowMiniGame] = useState(false); // ミニゲーム画面を出すか
  const [cursorPos, setCursorPos] = useState(0); // バーの位置(0-100)
  const [moveDirection, setMoveDirection] = useState(1); // 1:右へ, -1:左へ

  // ミニゲームのバーを動かすループ
  useEffect(() => {
    let interval: any;
    if (showMiniGame) {
      interval = setInterval(() => {
        setCursorPos((prev) => {
          let next = prev + (3 * moveDirection); // 速度調整はここの数字を変える
          if (next >= 100) { next = 100; setMoveDirection(-1); }
          if (next <= 0) { next = 0; setMoveDirection(1); }
          return next;
        });
      }, 10);
    }
    return () => clearInterval(interval);
  }, [showMiniGame, moveDirection]);

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
        if (board) {
          if (newState.p1_hp < board.p1_hp) triggerShake('p1');
          if (newState.p2_hp < board.p2_hp) triggerShake('p2');
        }
        setBoard(newState);
        checkGameOver(newState);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, board]);

  const triggerShake = (target: 'p1' | 'p2') => {
    if (target === 'p1') { setShakeP1(true); setTimeout(() => setShakeP1(false), 500); }
    else { setShakeP2(true); setTimeout(() => setShakeP2(false), 500); }
  };

  const checkGameOver = (state: any) => {
    if (!state) return;
    if (state.p1_hp <= 0) myRole === 'p1' ? handleDefeat() : handleVictory();
    else if (state.p2_hp <= 0) myRole === 'p2' ? handleDefeat() : handleVictory();
  };
  const handleVictory = async () => { if (!result) { setResult('win'); await (supabase.from('profile') as any).upsert({ user_id: myName, combatPower: 1200, name: myName }, { onConflict: 'user_id' }); } };
  const handleDefeat = () => { if (!result) setResult('lose'); };

  // --- 通常カード使用 ---
  const playCard = async (card: any, index: number) => {
    if (!board || result || board.turn !== myRole) return;
    const prefix = myRole === 'p1' ? 'p1' : 'p2';
    if (board[`${prefix}_energy`] < card.cost) return alert('⚡ エナジーが足りません！');

    setTimeout(async () => {
      let nextState = JSON.parse(JSON.stringify(board));
      const enemyPrefix = myRole === 'p1' ? 'p2' : 'p1';
      let log = `${myName}の${card.name}！`;

      nextState[`${prefix}_energy`] -= card.cost;
      const usedCard = nextState[`${prefix}_hand`].splice(index, 1)[0];
      nextState[`${prefix}_discard`].push(usedCard);

      // ★ゲージ上昇処理：カードを使うと +20 (最大100)
      nextState[`${prefix}_special`] = Math.min(100, (nextState[`${prefix}_special`] || 0) + 20);

      if (card.type === 'skill') {
        nextState[`${prefix}_block`] += card.val;
        log += ` 🛡️ブロック+${card.val}`;
      } else if (card.type === 'attack') {
        let damage = card.val;
        let targetBlock = nextState[`${enemyPrefix}_block`];
        let targetHp = nextState[`${enemyPrefix}_hp`];
        if (targetBlock >= damage) {
          targetBlock -= damage; damage = 0; log += ' 🛡️防がれた！';
        } else {
          damage -= targetBlock; targetBlock = 0; targetHp -= damage; log += ` ⚔️${damage}ダメージ！`;
          triggerShake(enemyPrefix);
        }
        nextState[`${enemyPrefix}_block`] = targetBlock;
        nextState[`${enemyPrefix}_hp`] = targetHp;
      }
      nextState.last_action = log;
      await updateBoard(nextState);
    }, 200);
  };

  // --- 🔥 必殺技実行ロジック (ミニゲーム結果) ---
  const executeUltimate = async () => {
    setShowMiniGame(false); // ミニゲーム閉じる
    
    // スコア計算：50(中心)に近いほど高い (0〜100点)
    // 50が中心。距離が0なら100点。距離が50なら0点。
    const distance = Math.abs(50 - cursorPos);
    const score = Math.max(0, 100 - (distance * 2)); 
    
    // ダメージ計算: スコアに応じて 10〜50ダメージ
    // (score / 100) * 40 + 10
    const damage = Math.floor((score / 100) * 40) + 10;

    let nextState = JSON.parse(JSON.stringify(board));
    const prefix = myRole === 'p1' ? 'p1' : 'p2';
    const enemyPrefix = myRole === 'p1' ? 'p2' : 'p1';

    let log = `🔥 ${myName}の必殺技！(精度${score}%)`;
    
    // 必殺ゲージ消費
    nextState[`${prefix}_special`] = 0;

    // ダメージ処理（必殺はブロック貫通などの特別ルールにしても面白いかも。今回は通常通り）
    let targetBlock = nextState[`${enemyPrefix}_block`];
    let targetHp = nextState[`${enemyPrefix}_hp`];
    let actualDamage = damage;

    if (targetBlock >= actualDamage) {
      targetBlock -= actualDamage; actualDamage = 0; log += ' 防がれた...';
    } else {
      actualDamage -= targetBlock; targetBlock = 0; targetHp -= actualDamage; 
      log += ` 💥${actualDamage}の大ダメージ！`;
      triggerShake(enemyPrefix);
    }
    
    nextState[`${enemyPrefix}_block`] = targetBlock;
    nextState[`${enemyPrefix}_hp`] = targetHp;
    nextState.last_action = log;

    await updateBoard(nextState);
  };

  const endTurn = async () => {
    if (!board || board.turn !== myRole) return;
    let nextState = JSON.parse(JSON.stringify(board));
    const prefix = myRole === 'p1' ? 'p1' : 'p2';
    const enemyPrefix = myRole === 'p1' ? 'p2' : 'p1';
    
    nextState[`${prefix}_discard`].push(...nextState[`${prefix}_hand`]);
    nextState[`${prefix}_hand`] = [];

    let enemyDeck = nextState[`${enemyPrefix}_deck`];
    let enemyDiscard = nextState[`${enemyPrefix}_discard`];
    let enemyHand = [];
    for (let i = 0; i < 5; i++) {
      if (enemyDeck.length === 0) {
        if (enemyDiscard.length === 0) break;
        enemyDeck = shuffle(enemyDiscard);
        enemyDiscard = [];
        nextState.last_action = 'デッキ再構築！';
      }
      enemyHand.push(enemyDeck.pop());
    }
    nextState[`${enemyPrefix}_deck`] = enemyDeck;
    nextState[`${enemyPrefix}_discard`] = enemyDiscard;
    nextState[`${enemyPrefix}_hand`] = enemyHand;
    nextState[`${enemyPrefix}_energy`] = 3;
    nextState[`${enemyPrefix}_block`] = 0;
    nextState.turn = enemyPrefix;
    await updateBoard(nextState);
  };

  const updateBoard = async (newState: any) => {
    await (supabase.from('battle_room') as any).update({ boardState: newState }).eq('id', roomId);
  };

  if (!board) return <div className="text-white p-10">読み込み中...</div>;

  const isMyTurn = board.turn === myRole;
  const prefix = myRole === 'p1' ? 'p1' : 'p2';
  const enemyPrefix = myRole === 'p1' ? 'p2' : 'p1';
  const myHand = board[`${prefix}_hand`] || [];
  const mySpecial = board[`${prefix}_special`] || 0; // ゲージ
  
  const enemyAreaClass = `bg-red-900/20 p-4 rounded-xl border border-red-500/30 text-center relative mt-2 transition-all ${enemyPrefix === 'p1' && shakeP1 ? 'animate-shake' : ''} ${enemyPrefix === 'p2' && shakeP2 ? 'animate-shake' : ''}`;
  const myAreaClass = `bg-blue-900/20 p-4 rounded-xl border border-blue-500/30 mb-2 transition-all ${prefix === 'p1' && shakeP1 ? 'animate-shake' : ''} ${prefix === 'p2' && shakeP2 ? 'animate-shake' : ''}`;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-2 flex flex-col justify-between select-none relative">
      
      {/* --- 🔥 ミニゲーム (モーダル) --- */}
      {showMiniGame && (
        <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center">
          <div className="text-3xl font-bold mb-4 text-yellow-400 animate-pulse">タイミングを合わせろ！</div>
          {/* バーの枠 */}
          <div className="w-80 h-10 bg-gray-700 rounded-full relative overflow-hidden border-4 border-white">
            {/* 成功ゾーン (真ん中) */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-10 bg-red-600/80 z-0"></div>
            {/* 動くカーソル */}
            <div 
              className="absolute top-0 bottom-0 w-2 bg-yellow-400 z-10 shadow-[0_0_10px_yellow]"
              style={{ left: `${cursorPos}%` }}
            />
          </div>
          <button 
            onClick={executeUltimate}
            className="mt-8 px-10 py-6 bg-red-600 text-white text-3xl font-black rounded-full shadow-[0_0_20px_red] hover:scale-105 active:scale-95"
          >
            STOP !
          </button>
        </div>
      )}

      {result && (
        <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center">
          <h1 className={`text-6xl font-bold mb-4 ${result === 'win' ? 'text-yellow-400' : 'text-blue-600'}`}>{result === 'win' ? 'VICTORY' : 'DEFEAT'}</h1>
          <button onClick={() => router.push('/pvp')} className="px-8 py-3 bg-white text-black font-bold rounded">ロビーへ</button>
        </div>
      )}

      {/* --- 敵エリア --- */}
      <div className={enemyAreaClass}>
        <div className="text-sm text-red-300">ENEMY</div>
        <div className="text-4xl font-bold">{board[`${enemyPrefix}_hp`]} HP</div>
        {board[`${enemyPrefix}_block`] > 0 && <div className="absolute top-4 right-4 bg-blue-600 px-3 py-1 rounded-full font-bold animate-bounce">🛡️ {board[`${enemyPrefix}_block`]}</div>}
        <div className="flex justify-center gap-1 mt-2">
           {[...Array(3)].map((_, i) => <div key={i} className={`w-3 h-3 rounded-full ${i < board[`${enemyPrefix}_energy`] ? 'bg-yellow-600' : 'bg-gray-700'}`} />)}
        </div>
        {/* 敵の必殺ゲージ */}
        <div className="w-1/2 mx-auto h-1 bg-gray-800 mt-2 rounded">
          <div className="h-full bg-purple-500 transition-all" style={{ width: `${board[`${enemyPrefix}_special`] || 0}%` }} />
        </div>
      </div>

      {/* --- ログ & ターン終了 --- */}
      <div className="flex-1 flex flex-col items-center justify-center gap-2">
        <div className="text-yellow-400 font-bold animate-pulse text-center px-4 h-8">{board.last_action}</div>
        <button onClick={endTurn} disabled={!isMyTurn}
          className={`px-8 py-3 rounded-full font-bold shadow-lg transition-all ${isMyTurn ? 'bg-blue-600 hover:scale-110 text-white' : 'bg-gray-700 text-gray-500 opacity-50'}`}>
          {isMyTurn ? 'ターン終了' : '相手のターン...'}
        </button>
      </div>

      {/* --- 自分エリア --- */}
      <div className={myAreaClass}>
        <div className="flex justify-between items-center mb-2 px-2">
          <div>
            <div className="text-sm text-blue-300">YOU ({myName})</div>
            <div className="text-3xl font-bold flex items-center gap-4">{board[`${prefix}_hp`]} HP {board[`${prefix}_block`] > 0 && <span className="text-xl bg-blue-600 px-2 rounded-full">🛡️{board[`${prefix}_block`]}</span>}</div>
            
            {/* ★ 必殺技ゲージ & ボタン */}
            <div className="flex items-center gap-2 mt-2">
              <div className="text-xs font-bold text-purple-400">LIMIT</div>
              <div className="w-32 h-4 bg-gray-800 rounded relative border border-gray-600 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${mySpecial >= 100 ? 'bg-purple-500 animate-pulse shadow-[0_0_10px_purple]' : 'bg-purple-900'}`} 
                  style={{ width: `${mySpecial}%` }} 
                />
              </div>
              {/* ゲージMAXでボタン出現 */}
              {mySpecial >= 100 && isMyTurn && (
                <button 
                  onClick={() => setShowMiniGame(true)}
                  className="px-3 py-1 bg-purple-600 text-white font-bold text-xs rounded animate-bounce shadow-[0_0_15px_purple] hover:scale-110"
                >
                  🔥必殺!
                </button>
              )}
            </div>

          </div>
          <div className="text-right">
            <div className="flex gap-1 mb-1 justify-end">{[...Array(3)].map((_, i) => <div key={i} className={`w-4 h-4 rounded-full border border-yellow-500 ${i < board[`${prefix}_energy`] ? 'bg-yellow-400' : ''}`} />)}</div>
            <div className="text-xs text-gray-400">山札: {board[`${prefix}_deck`]?.length} | 捨て札: {board[`${prefix}_discard`]?.length}</div>
          </div>
        </div>

        {/* 手札リスト */}
        <div className="flex gap-2 overflow-x-auto pb-2 min-h-[140px] items-end">
          {myHand.map((card: any, index: number) => (
            <button key={`${card.id}-${index}`} onClick={() => playCard(card, index)} disabled={!isMyTurn || board[`${prefix}_energy`] < card.cost}
              className={`flex-shrink-0 w-24 h-32 rounded-lg border-2 flex flex-col items-center justify-between p-1 transition-all relative ${!isMyTurn ? 'bg-gray-900 opacity-50' : board[`${prefix}_energy`] < card.cost ? 'bg-gray-800 grayscale' : card.type === 'attack' ? 'bg-red-950 border-red-500 hover:-translate-y-2' : 'bg-blue-950 border-blue-400 hover:-translate-y-2'}`}>
              <div className="absolute -top-2 -left-2 w-6 h-6 bg-yellow-500 text-black rounded-full flex items-center justify-center font-bold text-xs border border-white">{card.cost}</div>
              <div className="font-bold text-xs mt-2">{card.name}</div>
              <div className="text-[10px] text-gray-300 text-center leading-tight">{card.desc}</div>
              <div className={`text-lg font-black ${card.type === 'attack' ? 'text-red-400' : 'text-blue-400'}`}>{card.type === 'attack' ? `⚔️${card.val}` : `🛡️${card.val}`}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}