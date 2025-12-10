'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// 🎴 カードリスト (スロットも必殺技用の攻撃カードも全部入り)
const MASTER_DECK = [
  { id: 'slot-1', name: '運命のスロット', val: 0, cost: 0, type: 'skill', desc: '777で即死、💀で破滅' },
  { id: 'atk-1', name: 'ストライク', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
  { id: 'atk-2', name: 'ストライク', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
  { id: 'atk-3', name: 'ストライク', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
  { id: 'atk-4', name: '強打', val: 12, cost: 2, type: 'attack', desc: '12ダメージ' },
  { id: 'def-1', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
  { id: 'def-2', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
  { id: 'def-4', name: '鉄壁', val: 10, cost: 2, type: 'skill', desc: 'ブロック+10' },
];

const shuffle = (array: any[]) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const REEL_SYMBOLS = ['7️⃣', '💀', '🍒', '⚔️'];

export default function PvpBattle() {
  const { roomId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const myRole = searchParams.get('player'); 
  const myName = searchParams.get('name');
  
  const [board, setBoard] = useState<any>(null);
  const [result, setResult] = useState<'win' | 'lose' | null>(null);

  // --- ステート管理 (全部入り) ---
  // 演出用
  const [shakeP1, setShakeP1] = useState(false);
  const [shakeP2, setShakeP2] = useState(false);
  
  // 必殺技ミニゲーム用
  const [showMiniGame, setShowMiniGame] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const [moveDirection, setMoveDirection] = useState(1);

  // スロット用
  const [showSlot, setShowSlot] = useState(false);
  const [reels, setReels] = useState(['❓', '❓', '❓']);

  // --- 必殺技ミニゲームのループ ---
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

  // --- スロットマシンの回転ロジック ---
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
      // 確率調整 (777:2%, 💀:8%)
      const rand = Math.random() * 100;
      let finalReels = [];
      if (rand < 2) finalReels = ['7️⃣', '7️⃣', '7️⃣']; 
      else if (rand < 10) finalReels = ['💀', '💀', '💀']; 
      else if (rand < 20) finalReels = ['🍒', '🍒', '🍒']; 
      else if (rand < 40) finalReels = ['⚔️', '⚔️', '⚔️']; 
      else {
        finalReels = [
          REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)],
          REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)],
          REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)]
        ];
        if (finalReels[0] === finalReels[1] && finalReels[1] === finalReels[2]) {
          finalReels[2] = finalReels[0] === '7️⃣' ? '💀' : '7️⃣';
        }
      }

      setReels([finalReels[0], '🌀', '🌀']);
      await new Promise(r => setTimeout(r, 800));
      setReels([finalReels[0], finalReels[1], '🌀']);
      await new Promise(r => setTimeout(r, 1000));
      setReels(finalReels);

      await applySlotEffect(finalReels);
      setTimeout(() => setShowSlot(false), 2000);
    }, 2000);
  };

  const applySlotEffect = async (finalReels: string[]) => {
    if (!board) return;
    let nextState = JSON.parse(JSON.stringify(board));
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
    await updateBoard(nextState);
  };

  // ---------------------------------------------------

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

  const playCard = async (card: any, index: number) => {
    if (!board || result || board.turn !== myRole) return;
    const prefix = myRole === 'p1' ? 'p1' : 'p2';
    if (board[`${prefix}_energy`] < card.cost) return alert('⚡ エナジーが足りません！');

    // ★スロットカードなら専用処理
    if (card.id.startsWith('slot')) {
       let nextState = JSON.parse(JSON.stringify(board));
       nextState[`${prefix}_energy`] -= card.cost;
       const usedCard = nextState[`${prefix}_hand`].splice(index, 1)[0];
       nextState[`${prefix}_discard`].push(usedCard);
       await updateBoard(nextState);
       startSlotMachine();
       return;
    }

    setTimeout(async () => {
      let nextState = JSON.parse(JSON.stringify(board));
      const enemyPrefix = myRole === 'p1' ? 'p2' : 'p1';
      let log = `${myName}の${card.name}！`;

      nextState[`${prefix}_energy`] -= card.cost;
      const usedCard = nextState[`${prefix}_hand`].splice(index, 1)[0];
      nextState[`${prefix}_discard`].push(usedCard);
      
      // ★必殺ゲージ上昇 (+20)
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
    setShowMiniGame(false);
    const distance = Math.abs(50 - cursorPos);
    const score = Math.max(0, 100 - (distance * 2)); 
    const damage = Math.floor((score / 100) * 40) + 10;

    let nextState = JSON.parse(JSON.stringify(board));
    const prefix = myRole === 'p1' ? 'p1' : 'p2';
    const enemyPrefix = myRole === 'p1' ? 'p2' : 'p1';

    let log = `🔥 ${myName}の必殺技！(精度${score}%)`;
    nextState[`${prefix}_special`] = 0;

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
  const mySpecial = board[`${prefix}_special`] || 0;
  
  const enemyAreaClass = `bg-red-900/20 p-4 rounded-xl border border-red-500/30 text-center relative mt-2 transition-all ${enemyPrefix === 'p1' && shakeP1 ? 'animate-shake' : ''} ${enemyPrefix === 'p2' && shakeP2 ? 'animate-shake' : ''}`;
  const myAreaClass = `bg-blue-900/20 p-4 rounded-xl border border-blue-500/30 mb-2 transition-all ${prefix === 'p1' && shakeP1 ? 'animate-shake' : ''} ${prefix === 'p2' && shakeP2 ? 'animate-shake' : ''}`;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-2 flex flex-col justify-between select-none relative">
      
      {/* --- 🎰 スロット演出 --- */}
      {showSlot && (
        <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center animate-in fade-in">
          <h2 className="text-4xl font-bold text-yellow-500 mb-8 animate-pulse">運命のルーレット...</h2>
          <div className="flex gap-4 bg-gray-800 p-8 rounded-xl border-4 border-yellow-600 shadow-[0_0_50px_gold]">
            {reels.map((symbol, i) => <div key={i} className="w-24 h-32 bg-white text-black text-6xl flex items-center justify-center rounded border-4 border-gray-400 font-serif">{symbol}</div>)}
          </div>
        </div>
      )}

      {/* --- 🔥 必殺技ミニゲーム --- */}
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

      {/* --- 勝敗 --- */}
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
        {board[`${enemyPrefix}_block`] > 0 && <div className="absolute top-4 right-4 bg-blue-600 px-3 py-1 rounded-full font-bold">🛡️ {board[`${enemyPrefix}_block`]}</div>}
        <div className="flex justify-center gap-1 mt-2">
           {[...Array(3)].map((_, i) => <div key={i} className={`w-3 h-3 rounded-full ${i < board[`${enemyPrefix}_energy`] ? 'bg-yellow-600' : 'bg-gray-700'}`} />)}
        </div>
        <div className="w-1/2 mx-auto h-1 bg-gray-800 mt-2 rounded"><div className="h-full bg-purple-500 transition-all" style={{ width: `${board[`${enemyPrefix}_special`] || 0}%` }} /></div>
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
            {/* 必殺技ゲージ */}
            <div className="flex items-center gap-2 mt-2">
              <div className="text-xs font-bold text-purple-400">LIMIT</div>
              <div className="w-32 h-4 bg-gray-800 rounded relative border border-gray-600 overflow-hidden">
                <div className={`h-full transition-all duration-300 ${mySpecial >= 100 ? 'bg-purple-500 animate-pulse shadow-[0_0_10px_purple]' : 'bg-purple-900'}`} style={{ width: `${mySpecial}%` }} />
              </div>
              {mySpecial >= 100 && isMyTurn && (
                <button onClick={() => setShowMiniGame(true)} className="px-3 py-1 bg-purple-600 text-white font-bold text-xs rounded animate-bounce shadow-[0_0_15px_purple] hover:scale-110">🔥必殺!</button>
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
              className={`flex-shrink-0 w-24 h-32 rounded-lg border-2 flex flex-col items-center justify-between p-1 transition-all relative 
              ${!isMyTurn ? 'bg-gray-900 opacity-50' : board[`${prefix}_energy`] < card.cost ? 'bg-gray-800 grayscale' : 
                card.id.startsWith('slot') ? 'bg-purple-900 border-yellow-400 animate-pulse shadow-[0_0_10px_purple]' : 
                card.type === 'attack' ? 'bg-red-950 border-red-500 hover:-translate-y-2' : 'bg-blue-950 border-blue-400 hover:-translate-y-2'}`}>
              <div className="absolute -top-2 -left-2 w-6 h-6 bg-yellow-500 text-black rounded-full flex items-center justify-center font-bold text-xs border border-white">{card.cost}</div>
              <div className="font-bold text-xs mt-2">{card.name}</div>
              <div className="text-[10px] text-gray-300 text-center leading-tight">{card.desc}</div>
              <div className={`text-lg font-black ${card.id.startsWith('slot') ? 'text-yellow-400 text-2xl' : card.type === 'attack' ? 'text-red-400' : 'text-blue-400'}`}>
                {card.id.startsWith('slot') ? '🎰' : card.type === 'attack' ? `⚔️${card.val}` : `🛡️${card.val}`}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}