'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
// ------------------------------------
// ユーティリティ & 定数
// ------------------------------------
const shuffle = (array: any[]) => {
  const newArr = JSON.parse(JSON.stringify(array));
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const REEL_SYMBOLS = ['7️⃣', '💀', '🍒', '⚔️'];
const EMOTES = ['😎', '😱', '😡', '🙏', '👍', '🤔'];

export default function PvpBattle() {
  const { roomId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const myRole = searchParams.get('player'); 
  const myName = searchParams.get('name');
  
  const [board, setBoard] = useState<any>(null);
  const [result, setResult] = useState<'win' | 'lose' | null>(null);

  // 演出用
  const [shakeP1, setShakeP1] = useState(false);
  const [shakeP2, setShakeP2] = useState(false);
  const [showMiniGame, setShowMiniGame] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const [moveDirection, setMoveDirection] = useState(1);
  const [showSlot, setShowSlot] = useState(false);
  const [reels, setReels] = useState(['❓', '❓', '❓']);

  const prevHpRef = useRef({ p1: 50, p2: 50 });

  // --- 必殺技ミニゲームループ ---
  useEffect(() => {
    let interval: any;
    if (showMiniGame) {
      interval = setInterval(() => {
        setCursorPos((prev) => {
          let next = prev + (3 * moveDirection);
          if (next >= 100) { next = 100; setMoveDirection(-1); }
          if (next <= 0) { next = 0; setMoveDirection(1); }
          return next;
        });
      }, 10);
    }
    return () => clearInterval(interval);
  }, [showMiniGame, moveDirection]);

  // --- スロットロジック ---
  const startSlotMachine = async () => {
    setShowSlot(true);
    let spinCount = 0;
    const interval = setInterval(() => {
      setReels([
        REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)],
        REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)],
        REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)]
      ]);
      spinCount++;
    }, 50);

    setTimeout(async () => {
      clearInterval(interval);
      const rand = Math.random() * 100;
      let finalReels = [];
      if (rand < 5) finalReels = ['7️⃣', '7️⃣', '7️⃣']; 
      else if (rand < 15) finalReels = ['💀', '💀', '💀']; 
      else if (rand < 30) finalReels = ['🍒', '🍒', '🍒']; 
      else if (rand < 50) finalReels = ['⚔️', '⚔️', '⚔️']; 
      else {
        finalReels = [
          REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)],
          REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)],
          REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)]
        ];
        // 3つ揃ってたらハズレ用にずらす
        if (finalReels[0] === finalReels[1] && finalReels[1] === finalReels[2]) {
          finalReels[2] = finalReels[0] === '7️⃣' ? '💀' : '7️⃣';
        }
      }
      setReels(finalReels);
      await applySlotEffect(finalReels);
      setTimeout(() => setShowSlot(false), 2000);
    }, 2000);
  };

  const applySlotEffect = async (finalReels: string[]) => {
    // ★重要修正：ここです！
    // スロットが回っている間に時間が経過しているため、
    // ローカルの "board" ではなく、必ずサーバーから「最新の状態」を取得して計算します。
    // そうしないと、消費したエナジーが元に戻ってしまいます。
    const { data } = await (supabase.from('battle_room') as any).select('boardState').eq('id', roomId).single();
    if (!data) return;

    let nextState = data.boardState; // 最新データを取得
    const prefix = myRole === 'p1' ? 'p1' : 'p2';
    const enemyPrefix = myRole === 'p1' ? 'p2' : 'p1';
    let log = '';

    if (finalReels[0] === '7️⃣' && finalReels[1] === '7️⃣' && finalReels[2] === '7️⃣') {
      log = '🎰 JACKPOT!! 100ダメージ!!'; nextState[`${enemyPrefix}_hp`] -= 100;
    } else if (finalReels[0] === '💀' && finalReels[1] === '💀' && finalReels[2] === '💀') {
      log = '🎰 💀破滅... HPが1になった'; nextState[`${prefix}_hp`] = 1;
    } else if (finalReels[0] === '🍒' && finalReels[1] === '🍒' && finalReels[2] === '🍒') {
      log = '🎰 大当たり！全回復！'; nextState[`${prefix}_hp`] = 50;
    } else if (finalReels[0] === '⚔️' && finalReels[1] === '⚔️' && finalReels[2] === '⚔️') {
      log = '🎰 スリーソード！20ダメージ！'; nextState[`${enemyPrefix}_hp`] -= 20;
    } else {
      log = '🎰 ハズレ... 5ダメージ'; nextState[`${prefix}_hp`] -= 5;
    }
    nextState.last_action = log;
    
    checkGameOver(nextState);
    await updateBoard(nextState);
  };

  // --- Realtime Setup ---
  useEffect(() => {
    const fetchInitial = async () => {
      if (!roomId) return;
      const { data } = await (supabase.from('battle_room') as any).select('*').eq('id', roomId as string).single();
      if (data) {
        setBoard(data.boardState);
        prevHpRef.current = { p1: data.boardState.p1_hp, p2: data.boardState.p2_hp };
      }
    };
    fetchInitial();

    const channel = supabase.channel(`room-${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battle_room', filter: `id=eq.${roomId}` }, 
      (payload) => {
        const newState = (payload.new as any).boardState;
        if (newState.p1_hp < prevHpRef.current.p1) triggerShake('p1');
        if (newState.p2_hp < prevHpRef.current.p2) triggerShake('p2');
        prevHpRef.current = { p1: newState.p1_hp, p2: newState.p2_hp };
        setBoard(newState);
        checkGameOver(newState);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const triggerShake = (target: 'p1' | 'p2') => {
    if (target === 'p1') { setShakeP1(true); setTimeout(() => setShakeP1(false), 500); }
    else { setShakeP2(true); setTimeout(() => setShakeP2(false), 500); }
  };

  const checkGameOver = (state: any) => {
    if (!state || result) return;
    if (state.p1_hp <= 0) {
      if (myRole === 'p1') handleDefeat(); else handleVictory();
    } 
    else if (state.p2_hp <= 0) {
      if (myRole === 'p2') handleDefeat(); else handleVictory();
    }
  };

  const handleVictory = async () => { 
    setResult('win'); 
    await (supabase.from('profile') as any).upsert({ user_id: myName, combatPower: 1200, name: myName }, { onConflict: 'user_id' }); 
  };
  
  const handleDefeat = () => { setResult('lose'); };

  // --- カード使用 ---
  const playCard = async (card: any, index: number) => {
    if (!board || result || board.turn !== myRole) return;
    const prefix = myRole === 'p1' ? 'p1' : 'p2';
    if (board[`${prefix}_energy`] < card.cost) return alert('⚡ エナジーが足りません！');

    // スロット
    if (card.id.startsWith('slot')) {
       let nextState = JSON.parse(JSON.stringify(board));
       // ★ここでエナジーを減らす
       nextState[`${prefix}_energy`] -= card.cost;
       const usedCard = nextState[`${prefix}_hand`].splice(index, 1)[0];
       nextState[`${prefix}_discard`].push(usedCard);
       
       // エナジー消費を即座に保存
       await updateBoard(nextState);
       // その後スロット開始
       startSlotMachine();
       return;
    }

    // 通常カード
    setTimeout(async () => {
      let nextState = JSON.parse(JSON.stringify(board));
      const enemyPrefix = myRole === 'p1' ? 'p2' : 'p1';
      let log = `${myName}の${card.name}！`;

      nextState[`${prefix}_energy`] -= card.cost;
      const usedCard = nextState[`${prefix}_hand`].splice(index, 1)[0];
      nextState[`${prefix}_discard`].push(usedCard);
      nextState[`${prefix}_special`] = Math.min(100, (nextState[`${prefix}_special`] || 0) + 20);

      if (card.effect === 'poison') {
        nextState[`${enemyPrefix}_poison`] = (nextState[`${enemyPrefix}_poison`] || 0) + card.val;
        log += ` ☠️相手に毒${card.val}!`;
      } 
      else if (card.effect === 'stun') {
        nextState[`${enemyPrefix}_stun`] = true;
        nextState[`${enemyPrefix}_hp`] -= card.val;
        log += ` ⚡スタン付与! ${card.val}ダメ`;
        triggerShake(enemyPrefix);
      }
      else if (card.effect === 'heal') {
        let damage = card.val;
        nextState[`${enemyPrefix}_hp`] -= damage;
        nextState[`${prefix}_hp`] += card.val;
        log += ` 🩸${damage}吸い取った!`;
        triggerShake(enemyPrefix);
      }
      else if (card.type === 'skill') {
        nextState[`${prefix}_block`] += card.val;
        log += ` 🛡️ブロック+${card.val}`;
      } 
      else if (card.type === 'attack') {
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
      checkGameOver(nextState);
      await updateBoard(nextState);
    }, 200);
  };

  const executeUltimate = async () => {
    setShowMiniGame(false);
    const distance = Math.abs(50 - cursorPos);
    const score = Math.max(0, 100 - (distance * 2)); 
    const damage = Math.floor((score / 100) * 40) + 10;

    // 必殺技も時間経過があるので、念のため最新stateを取るのが安全だが
    // 今回はスロットほど時間がかからないのでlocal stateでもギリギリOK。
    // でも安全策でfetchするパターンに統一しても良い。今回はそのまま。
    let nextState = JSON.parse(JSON.stringify(board));
    const prefix = myRole === 'p1' ? 'p1' : 'p2';
    const enemyPrefix = myRole === 'p1' ? 'p2' : 'p1';

    let log = `🔥 ${myName}の必殺技！(精度${score}%)`;
    nextState[`${prefix}_special`] = 0;
    
    nextState[`${enemyPrefix}_hp`] -= damage;
    log += ` 💥ガード不能 ${damage}ダメージ！`;
    triggerShake(enemyPrefix);

    nextState.last_action = log;
    checkGameOver(nextState);
    await updateBoard(nextState);
  };

  const sendEmote = async (emote: string) => {
    if (!board) return;
    const prefix = myRole === 'p1' ? 'p1' : 'p2';
    await (supabase.from('battle_room') as any).update({ 
      boardState: { ...board, [`${prefix}_emote`]: emote } 
    }).eq('id', roomId);
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
    let enemyHand = nextState[`${enemyPrefix}_hand`] || [];
    if (enemyHand.length < 5) {
      const drawCount = 5 - enemyHand.length;
      for (let i = 0; i < drawCount; i++) {
        if (enemyDeck.length === 0) {
          if (enemyDiscard.length === 0) break;
          enemyDeck = shuffle(enemyDiscard);
          enemyDiscard = [];
          nextState.last_action = 'デッキ再構築！';
        }
        enemyHand.push(enemyDeck.pop());
      }
    }
    nextState[`${enemyPrefix}_deck`] = enemyDeck;
    nextState[`${enemyPrefix}_discard`] = enemyDiscard;
    nextState[`${enemyPrefix}_hand`] = enemyHand;

    // 状態異常
    let enemyEnergy = 3;
    let log = '';

    if (nextState[`${enemyPrefix}_stun`]) {
      enemyEnergy = 1;
      nextState[`${enemyPrefix}_stun`] = false;
      log += ' ⚡スタンで動けない！';
    }
    nextState[`${enemyPrefix}_energy`] = enemyEnergy;
    nextState[`${enemyPrefix}_block`] = 0;

    if ((nextState[`${enemyPrefix}_poison`] || 0) > 0) {
      const poisonDmg = nextState[`${enemyPrefix}_poison`];
      nextState[`${enemyPrefix}_hp`] -= poisonDmg;
      log += ` ☠️毒で${poisonDmg}ダメ`;
      nextState[`${enemyPrefix}_poison`] = Math.max(0, poisonDmg - 1);
      triggerShake(enemyPrefix);
    }
    
    if (log) nextState.last_action = log;
    else nextState.last_action = `${myName} ターン終了`;

    nextState.turn = enemyPrefix;
    checkGameOver(nextState);
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
  const mySpecial = board[`${prefix}_special`] || 0;
  const myPoison = board[`${prefix}_poison`] || 0;
  const myStun = board[`${prefix}_stun`] || false;
  const enemyPoison = board[`${enemyPrefix}_poison`] || 0;
  const enemyStun = board[`${enemyPrefix}_stun`] || false;

  const enemyAreaClass = `bg-red-900/20 p-4 rounded-xl border border-red-500/30 text-center relative mt-2 transition-all ${enemyPrefix === 'p1' && shakeP1 ? 'animate-shake' : ''} ${enemyPrefix === 'p2' && shakeP2 ? 'animate-shake' : ''}`;
  const myAreaClass = `bg-blue-900/20 p-4 rounded-xl border border-blue-500/30 mb-2 transition-all ${prefix === 'p1' && shakeP1 ? 'animate-shake' : ''} ${prefix === 'p2' && shakeP2 ? 'animate-shake' : ''}`;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-2 flex flex-col justify-between select-none relative">
      
      {showSlot && (
        <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center animate-in fade-in">
          <h2 className="text-4xl font-bold text-yellow-500 mb-8 animate-pulse">運命のルーレット...</h2>
          <div className="flex gap-4 bg-gray-800 p-8 rounded-xl border-4 border-yellow-600 shadow-[0_0_50px_gold]">
            {reels.map((symbol, i) => <div key={i} className="w-24 h-32 bg-white text-black text-6xl flex items-center justify-center rounded border-4 border-gray-400 font-serif">{symbol}</div>)}
          </div>
        </div>
      )}

      {showMiniGame && (
        <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center">
          <div className="text-3xl font-bold mb-4 text-yellow-400 animate-pulse">タイミングを合わせろ！</div>
          <div className="w-80 h-10 bg-gray-700 rounded-full relative overflow-hidden border-4 border-white">
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-10 bg-red-600/80 z-0"></div>
            <div className="absolute top-0 bottom-0 w-2 bg-yellow-400 z-10 shadow-[0_0_10px_yellow]" style={{ left: `${cursorPos}%` }} />
          </div>
          <button onClick={executeUltimate} className="mt-8 px-10 py-6 bg-red-600 text-white text-3xl font-black rounded-full shadow-[0_0_20px_red] hover:scale-105 active:scale-95">STOP !</button>
        </div>
      )}

      {result && (
        <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center animate-in fade-in zoom-in">
          <h1 className={`text-6xl font-bold mb-4 ${result === 'win' ? 'text-yellow-400' : 'text-blue-600'}`}>{result === 'win' ? 'VICTORY' : 'DEFEAT'}</h1>
          <button onClick={() => router.push('/pvp')} className="px-8 py-3 bg-white text-black font-bold rounded hover:scale-105 transition">ロビーへ</button>
        </div>
      )}

      <div className={enemyAreaClass}>
        <div className="text-sm text-red-300">ENEMY ({board[`${enemyPrefix}_job`]})</div>
        {board[`${enemyPrefix}_emote`] && <div className="absolute -left-4 top-0 text-6xl animate-bounce drop-shadow-lg z-20">{board[`${enemyPrefix}_emote`]}</div>}
        <div className="text-4xl font-bold flex justify-center items-center gap-2">
          {Math.max(0, board[`${enemyPrefix}_hp`])} HP
          {enemyPoison > 0 && <span className="text-sm bg-purple-900 px-2 rounded">☠️{enemyPoison}</span>}
          {enemyStun && <span className="text-sm bg-yellow-600 px-2 rounded animate-pulse">⚡STAN</span>}
        </div>
        {board[`${enemyPrefix}_block`] > 0 && <div className="absolute top-4 right-4 bg-blue-600 px-3 py-1 rounded-full font-bold">🛡️ {board[`${enemyPrefix}_block`]}</div>}
        <div className="flex justify-center gap-1 mt-2">{[...Array(3)].map((_, i) => <div key={i} className={`w-3 h-3 rounded-full ${i < board[`${enemyPrefix}_energy`] ? 'bg-yellow-600' : 'bg-gray-700'}`} />)}</div>
        <div className="w-1/2 mx-auto h-1 bg-gray-800 mt-2 rounded"><div className="h-full bg-purple-500 transition-all" style={{ width: `${board[`${enemyPrefix}_special`] || 0}%` }} /></div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-2">
        <div className="text-yellow-400 font-bold animate-pulse text-center px-4 h-8">{board.last_action}</div>
        <button onClick={endTurn} disabled={!isMyTurn || result !== null}
          className={`px-8 py-3 rounded-full font-bold shadow-lg transition-all ${isMyTurn && !result ? 'bg-blue-600 hover:scale-110 text-white' : 'bg-gray-700 text-gray-500 opacity-50'}`}>
          {isMyTurn ? 'ターン終了' : '相手のターン...'}
        </button>
      </div>

      <div className={myAreaClass}>
        <div className="flex justify-between items-center mb-2 px-2 relative">
          {board[`${prefix}_emote`] && <div className="absolute -right-2 -top-10 text-6xl animate-bounce drop-shadow-lg z-20">{board[`${prefix}_emote`]}</div>}
          <div>
            <div className="text-sm text-blue-300">YOU ({myName})</div>
            <div className="text-3xl font-bold flex items-center gap-2">
              {Math.max(0, board[`${prefix}_hp`])} HP
              {board[`${prefix}_block`] > 0 && <span className="text-xl bg-blue-600 px-2 rounded-full">🛡️{board[`${prefix}_block`]}</span>}
              {myPoison > 0 && <span className="text-sm bg-purple-900 px-2 rounded">☠️{myPoison}</span>}
              {myStun && <span className="text-sm bg-yellow-600 px-2 rounded animate-pulse">⚡STAN</span>}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="text-xs font-bold text-purple-400">LIMIT</div>
              <div className="w-32 h-4 bg-gray-800 rounded relative border border-gray-600 overflow-hidden">
                <div className={`h-full transition-all duration-300 ${mySpecial >= 100 ? 'bg-purple-500 animate-pulse shadow-[0_0_10px_purple]' : 'bg-purple-900'}`} style={{ width: `${mySpecial}%` }} />
              </div>
              {mySpecial >= 100 && isMyTurn && !result && (
                <button onClick={() => setShowMiniGame(true)} className="px-3 py-1 bg-purple-600 text-white font-bold text-xs rounded animate-bounce shadow-[0_0_15px_purple] hover:scale-110">🔥必殺!</button>
              )}
            </div>
          </div>
          <div className="flex gap-1 absolute bottom-full right-0 mb-2">
             {EMOTES.map(e => <button key={e} onClick={() => sendEmote(e)} className="text-xl bg-gray-800 hover:bg-gray-700 rounded p-1 shadow border border-gray-600">{e}</button>)}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 min-h-[140px] items-end">
          {myHand.map((card: any, index: number) => (
            <button key={`${card.id}-${index}`} onClick={() => playCard(card, index)} disabled={!isMyTurn || board[`${prefix}_energy`] < card.cost || result !== null}
              className={`flex-shrink-0 w-24 h-32 rounded-lg border-2 flex flex-col items-center justify-between p-1 transition-all relative 
              ${!isMyTurn || result ? 'bg-gray-900 opacity-50' : board[`${prefix}_energy`] < card.cost ? 'bg-gray-800 grayscale' : 
                card.id.startsWith('slot') ? 'bg-purple-900 border-yellow-400 animate-pulse shadow-[0_0_10px_purple]' : 
                card.effect === 'poison' ? 'bg-purple-950 border-purple-400' :
                card.effect === 'stun' ? 'bg-yellow-950 border-yellow-400' :
                card.type === 'attack' ? 'bg-red-950 border-red-500 hover:-translate-y-2' : 'bg-blue-950 border-blue-400 hover:-translate-y-2'}`}>
              <div className="absolute -top-2 -left-2 w-6 h-6 bg-yellow-500 text-black rounded-full flex items-center justify-center font-bold text-xs border border-white">{card.cost}</div>
              <div className="font-bold text-xs mt-2">{card.name}</div>
              <div className="text-[10px] text-gray-300 text-center leading-tight">{card.desc}</div>
              <div className={`text-lg font-black ${card.id.startsWith('slot') ? 'text-yellow-400 text-2xl' : card.effect ? 'text-green-400' : card.type === 'attack' ? 'text-red-400' : 'text-blue-400'}`}>
                {card.id.startsWith('slot') ? '🎰' : card.type === 'attack' ? `⚔️${card.val}` : `🛡️${card.val}`}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}