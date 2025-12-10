'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ------------------------------------
// 定数・データ
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
const WEATHER_TYPES = ['none', 'volcano', 'sanctuary', 'storm'];

const RELIC_DATA: any = {
  vampire_fang: { icon: '🧛', desc: '攻撃でダメージを与えるとHPが1回復' },
  titan_shield: { icon: '🛡️', desc: 'ターン開始時にブロック+3' },
  energy_ring: { icon: '💍', desc: 'HPが20以下の時、ターン開始時のエナジー+1' },
  lucky_coin: { icon: '🪙', desc: 'スロットで777が出る確率が2倍になる' },
};

function PvpBattleContent() {
  const { roomId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const myRole = searchParams.get('player'); 
  const myName = searchParams.get('name');
  
  const [board, setBoard] = useState<any>(null);
  const [result, setResult] = useState<'win' | 'lose' | null>(null);

  const [shakeP1, setShakeP1] = useState(false);
  const [shakeP2, setShakeP2] = useState(false);
  const [breakAnim, setBreakAnim] = useState(false);
  const [showMiniGame, setShowMiniGame] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const [moveDirection, setMoveDirection] = useState(1);
  const [showSlot, setShowSlot] = useState(false);
  const [reels, setReels] = useState(['❓', '❓', '❓']);

  const prevHpRef = useRef({ p1: 50, p2: 50 });

  // 必殺技ループ
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

  // スロットロジック
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
      const prefix = myRole === 'p1' ? 'p1' : 'p2';
      const myRelic = board[`${prefix}_relic`];
      const jackpotChance = myRelic === 'lucky_coin' ? 10 : 5; 

      if (rand < jackpotChance) finalReels = ['7️⃣', '7️⃣', '7️⃣']; 
      else if (rand < 15) finalReels = ['💀', '💀', '💀']; 
      else if (rand < 30) finalReels = ['🍒', '🍒', '🍒']; 
      else if (rand < 50) finalReels = ['⚔️', '⚔️', '⚔️']; 
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
      setReels(finalReels);
      await applySlotEffect(finalReels);
      setTimeout(() => setShowSlot(false), 2000);
    }, 2000);
  };

  const applySlotEffect = async (finalReels: string[]) => {
    const { data } = await (supabase.from('battle_room') as any).select('boardState').eq('id', roomId).single();
    if (!data) return;
    let nextState = data.boardState;
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

  // --- ★修正版 Realtime Setup (データ受信のみ) ---
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
        
        // 演出トリガー
        if (newState.p1_vulnerable && !board?.p1_vulnerable) { setBreakAnim(true); setTimeout(() => setBreakAnim(false), 1000); }
        if (newState.p2_vulnerable && !board?.p2_vulnerable) { setBreakAnim(true); setTimeout(() => setBreakAnim(false), 1000); }
        if (newState.p1_hp < prevHpRef.current.p1) triggerShake('p1');
        if (newState.p2_hp < prevHpRef.current.p2) triggerShake('p2');
        
        prevHpRef.current = { p1: newState.p1_hp, p2: newState.p2_hp };
        setBoard(newState); // ここでは board を更新するだけ
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, board]); // boardを依存配列に入れて比較可能にする

  // --- ★新設: 勝敗監視専用 useEffect ---
  // board のデータが変わるたびに「HPは0か？」をチェックします
  useEffect(() => {
    if (!board || result) return; // すでに決着していたら無視

    // P1が負けた場合
    if (board.p1_hp <= 0) {
      // 演出強制オフ
      setShowMiniGame(false); setShowSlot(false);
      
      if (myRole === 'p1') {
        setResult('lose'); // 自分がP1なら負け画面
      } else {
        handleVictory(); // 自分がP2なら勝ち処理
      }
    } 
    // P2が負けた場合
    else if (board.p2_hp <= 0) {
      setShowMiniGame(false); setShowSlot(false);

      if (myRole === 'p2') {
        setResult('lose'); // 自分がP2なら負け画面
      } else {
        handleVictory(); // 自分がP1なら勝ち処理
      }
    }
  }, [board, result, myRole]); // boardが変わるたびに発動！

  const handleVictory = async () => { 
    if(result === 'win') return; // 二重送信防止
    setResult('win'); 
    await (supabase.from('profile') as any).upsert({ user_id: myName, combatPower: 1200, name: myName }, { onConflict: 'user_id' }); 
  };
  
  const triggerShake = (target: 'p1' | 'p2') => {
    if (target === 'p1') { setShakeP1(true); setTimeout(() => setShakeP1(false), 500); }
    else { setShakeP2(true); setTimeout(() => setShakeP2(false), 500); }
  };

  const goBackToLobby = () => {
    window.location.href = '/pvp';
  };

  // --- カード使用ロジック ---
  const playCard = async (card: any, index: number) => {
    if (!board || result || board.turn !== myRole) return;
    const prefix = myRole === 'p1' ? 'p1' : 'p2';
    if (board[`${prefix}_energy`] < card.cost) return alert('⚡ エナジーが足りません！');

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
      const myRelic = nextState[`${prefix}_relic`]; 
      let log = `${myName}の${card.name}！`;

      nextState[`${prefix}_energy`] -= card.cost;
      const usedCard = nextState[`${prefix}_hand`].splice(index, 1)[0];
      nextState[`${prefix}_discard`].push(usedCard);
      nextState[`${prefix}_special`] = Math.min(100, (nextState[`${prefix}_special`] || 0) + 20);

      const isVulnerable = nextState[`${enemyPrefix}_vulnerable`];
      const damageMultiplier = isVulnerable ? 2 : 1;

      if (card.effect === 'poison') {
        nextState[`${enemyPrefix}_poison`] = (nextState[`${enemyPrefix}_poison`] || 0) + card.val;
        log += ` ☠️相手に毒${card.val}!`;
      } 
      else if (card.effect === 'stun') {
        nextState[`${enemyPrefix}_stun`] = true;
        nextState[`${enemyPrefix}_hp`] -= (card.val * damageMultiplier);
        log += ` ⚡スタン付与!`;
        triggerShake(enemyPrefix);
      }
      else if (card.effect === 'heal') {
        let damage = card.val * damageMultiplier;
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
        let damage = card.val * damageMultiplier;
        let targetBlock = nextState[`${enemyPrefix}_block`];
        let targetHp = nextState[`${enemyPrefix}_hp`];

        if (targetBlock > 0 && damage > targetBlock) {
           log += " 💥CRASH!!(脆弱)";
           nextState[`${enemyPrefix}_vulnerable`] = true;
        }

        if (targetBlock >= damage) {
          targetBlock -= damage; damage = 0; log += ' 🛡️防がれた！';
        } else {
          damage -= targetBlock; targetBlock = 0; targetHp -= damage; 
          log += ` ⚔️${damage}ダメージ！`;
          triggerShake(enemyPrefix);
          if (myRelic === 'vampire_fang') {
             nextState[`${prefix}_hp`] += 1;
             log += ' 🧛(吸血+1)';
          }
        }
        nextState[`${enemyPrefix}_block`] = targetBlock;
        nextState[`${enemyPrefix}_hp`] = targetHp;
      }
      
      nextState.last_action = log;
      await updateBoard(nextState);
    }, 200);
  };

  const executeUltimate = async () => {
    setShowMiniGame(false);
    const distance = Math.abs(50 - cursorPos);
    const score = Math.max(0, 100 - (distance * 2)); 
    const damage = Math.floor((score / 100) * 40) + 10;
    let nextState = JSON.parse(JSON.stringify(board));
    const prefix = myRole === 'p1' ? 'p1' : 'p2';
    const enemyPrefix = myRole === 'p1' ? 'p2' : 'p1';
    
    const isVulnerable = nextState[`${enemyPrefix}_vulnerable`];
    const finalDamage = isVulnerable ? damage * 2 : damage;

    let log = `🔥必殺！(${score}%)`;
    nextState[`${prefix}_special`] = 0;
    nextState[`${enemyPrefix}_hp`] -= finalDamage;
    log += ` 💥${finalDamage}ダメージ！`;
    triggerShake(enemyPrefix);
    nextState.last_action = log;
    await updateBoard(nextState);
  };

  const sendEmote = async (emote: string) => {
    if (!board) return;
    const prefix = myRole === 'p1' ? 'p1' : 'p2';
    await (supabase.from('battle_room') as any).update({ boardState: { ...board, [`${prefix}_emote`]: emote } }).eq('id', roomId);
  };

  const synthesizeHand = (hand: any[]) => {
    const counts: any = {};
    const newHand: any[] = [];
    let synthesized = false;
    hand.forEach(card => {
      if (card.rank === 2 || card.id.startsWith('slot')) { newHand.push(card); return; }
      if (!counts[card.name]) counts[card.name] = [];
      counts[card.name].push(card);
    });
    Object.keys(counts).forEach(key => {
      const cards = counts[key];
      while (cards.length >= 2) {
        const c1 = cards.pop(); const c2 = cards.pop();
        const newCard = { ...c1, id: c1.id + '_plus', name: '★' + c1.name, val: Math.floor(c1.val * 1.5), cost: Math.max(0, c1.cost - 1), rank: 2, desc: `(合成) ${Math.floor(c1.val * 1.5)}効果 / コスト-1` };
        newHand.push(newCard); synthesized = true;
      }
      while (cards.length > 0) newHand.push(cards.pop());
    });
    return { hand: newHand, synthesized };
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
        }
        enemyHand.push(enemyDeck.pop());
      }
    }

    const synResult = synthesizeHand(enemyHand);
    enemyHand = synResult.hand;
    nextState[`${enemyPrefix}_hand`] = enemyHand;

    nextState.turn_count = (nextState.turn_count || 1) + 1;
    if (nextState.turn_count % 5 === 0) {
       const weathers = WEATHER_TYPES.filter(w => w !== nextState.weather);
       nextState.weather = weathers[Math.floor(Math.random() * weathers.length)];
    }

    nextState[`${enemyPrefix}_energy`] = 3;
    nextState[`${enemyPrefix}_block`] = 0;
    nextState[`${enemyPrefix}_vulnerable`] = false;

    let log = '';
    if (synResult.synthesized) log += ' 🧬カード合成!';
    
    if (nextState.weather === 'volcano') { nextState[`${enemyPrefix}_hp`] -= 2; nextState[`${prefix}_hp`] -= 2; log += ' 🔥火山ダメ'; }
    else if (nextState.weather === 'sanctuary') { nextState[`${enemyPrefix}_hp`] += 2; log += ' ✨聖域回復'; }
    else if (nextState.weather === 'storm') { enemyHand.forEach((c:any) => c.cost = Math.floor(Math.random() * 4)); log += ' 🌀暴風コスト変化'; }

    if (nextState[`${enemyPrefix}_stun`]) { nextState[`${enemyPrefix}_energy`] = 1; nextState[`${enemyPrefix}_stun`] = false; log += ' ⚡スタン中'; }

    if ((nextState[`${enemyPrefix}_poison`] || 0) > 0) {
      const poisonDmg = nextState[`${enemyPrefix}_poison`];
      nextState[`${enemyPrefix}_hp`] -= poisonDmg;
      nextState[`${enemyPrefix}_poison`] = Math.max(0, poisonDmg - 1);
      log += ` ☠️毒${poisonDmg}`;
    }
    
    if (!log) log = `${myName} ターン終了`;
    nextState.last_action = log;
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
  const myPoison = board[`${prefix}_poison`] || 0;
  const myStun = board[`${prefix}_stun`] || false;
  const myVulnerable = board[`${prefix}_vulnerable`] || false;
  const myRelicId = board[`${prefix}_relic`]; 
  const enemyPoison = board[`${enemyPrefix}_poison`] || 0;
  const enemyStun = board[`${enemyPrefix}_stun`] || false;
  const enemyVulnerable = board[`${enemyPrefix}_vulnerable`] || false;
  const enemyRelicId = board[`${enemyPrefix}_relic`]; 
  const weather = board.weather || 'none';
  const weatherIcon = weather === 'volcano' ? '🔥 火山' : weather === 'sanctuary' ? '✨ 聖域' : weather === 'storm' ? '🌀 暴風' : '';

  const enemyAreaClass = `bg-red-900/20 p-4 rounded-xl border border-red-500/30 text-center relative mt-2 transition-all 
    ${enemyPrefix === 'p1' && shakeP1 ? 'animate-shake' : ''} ${enemyPrefix === 'p2' && shakeP2 ? 'animate-shake' : ''}
    ${enemyVulnerable || breakAnim ? 'animate-break' : ''}`;

  const myAreaClass = `bg-blue-900/20 p-4 rounded-xl border border-blue-500/30 mb-2 transition-all ${prefix === 'p1' && shakeP1 ? 'animate-shake' : ''} ${prefix === 'p2' && shakeP2 ? 'animate-shake' : ''}`;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-2 flex flex-col justify-between select-none relative">
      {/* 演出モーダル */}
      {showSlot && ( <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center animate-in fade-in"> <h2 className="text-4xl font-bold text-yellow-500 mb-8 animate-pulse">運命のルーレット...</h2> <div className="flex gap-4 bg-gray-800 p-8 rounded-xl border-4 border-yellow-600 shadow-[0_0_50px_gold]"> {reels.map((symbol, i) => <div key={i} className="w-24 h-32 bg-white text-black text-6xl flex items-center justify-center rounded border-4 border-gray-400 font-serif">{symbol}</div>)} </div> </div> )}
      {showMiniGame && ( <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center"> <div className="text-3xl font-bold mb-4 text-yellow-400 animate-pulse">タイミングを合わせろ！</div> <div className="w-80 h-10 bg-gray-700 rounded-full relative overflow-hidden border-4 border-white"> <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-10 bg-red-600/80 z-0"></div> <div className="absolute top-0 bottom-0 w-2 bg-yellow-400 z-10 shadow-[0_0_10px_yellow]" style={{ left: `${cursorPos}%` }} /> </div> <button onClick={executeUltimate} className="mt-8 px-10 py-6 bg-red-600 text-white text-3xl font-black rounded-full shadow-[0_0_20px_red] hover:scale-105 active:scale-95">STOP !</button> </div> )}
      
      {/* ★ リザルト画面 (z-index最強 & 強制遷移) */}
      {result && ( 
        <div className="absolute inset-0 bg-black/95 z-[9999] flex flex-col items-center justify-center animate-in fade-in zoom-in"> 
          <h1 className={`text-6xl font-bold mb-4 ${result === 'win' ? 'text-yellow-400' : 'text-blue-600'}`}>{result === 'win' ? 'VICTORY' : 'DEFEAT'}</h1> 
          <button onClick={goBackToLobby} className="px-8 py-3 bg-white text-black font-bold rounded hover:scale-105 transition cursor-pointer z-[10000]">ロビーへ</button> 
        </div> 
      )}

      {weather !== 'none' && <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/50 px-4 py-1 rounded-full text-sm border border-white z-10">{weatherIcon}</div>}

      <div className={enemyAreaClass}>
        <div className="text-sm text-red-300">ENEMY ({board[`${enemyPrefix}_job`]})</div>
        {board[`${enemyPrefix}_emote`] && <div className="absolute -left-4 top-0 text-6xl animate-bounce drop-shadow-lg z-20">{board[`${enemyPrefix}_emote`]}</div>}
        {enemyRelicId && RELIC_DATA[enemyRelicId] && (<div className="absolute top-0 left-2 text-2xl" title={RELIC_DATA[enemyRelicId].desc}>{RELIC_DATA[enemyRelicId].icon}</div>)}
        <div className="text-4xl font-bold flex justify-center items-center gap-2">
          {Math.max(0, board[`${enemyPrefix}_hp`])} HP
          {enemyPoison > 0 && <span className="text-sm bg-purple-900 px-2 rounded">☠️{enemyPoison}</span>}
          {enemyStun && <span className="text-sm bg-yellow-600 px-2 rounded animate-pulse">⚡STAN</span>}
          {enemyVulnerable && <span className="text-sm bg-red-600 px-2 rounded animate-pulse">💔脆弱</span>}
        </div>
        {board[`${enemyPrefix}_block`] > 0 && <div className="absolute top-4 right-4 bg-blue-600 px-3 py-1 rounded-full font-bold">🛡️ {board[`${enemyPrefix}_block`]}</div>}
        <div className="flex justify-center gap-1 mt-2">{[...Array(3)].map((_, i) => <div key={i} className={`w-3 h-3 rounded-full ${i < board[`${enemyPrefix}_energy`] ? 'bg-yellow-600' : 'bg-gray-700'}`} />)}</div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-2">
        <div className="text-yellow-400 font-bold animate-pulse text-center px-4 h-8">{board.last_action}</div>
        <button onClick={endTurn} disabled={!isMyTurn || result !== null} className={`px-8 py-3 rounded-full font-bold shadow-lg transition-all ${isMyTurn && !result ? 'bg-blue-600 hover:scale-110 text-white' : 'bg-gray-700 text-gray-500 opacity-50'}`}> {isMyTurn ? 'ターン終了' : '相手のターン...'} </button>
      </div>

      <div className={myAreaClass}>
        <div className="flex justify-between items-center mb-2 px-2 relative">
          {board[`${prefix}_emote`] && <div className="absolute -right-2 -top-10 text-6xl animate-bounce drop-shadow-lg z-20">{board[`${prefix}_emote`]}</div>}
          <div>
            <div className="text-sm text-blue-300">YOU ({myName})</div>
            {myRelicId && RELIC_DATA[myRelicId] && ( <div className="flex items-center gap-2 mb-1" title={RELIC_DATA[myRelicId].desc}> <span className="text-2xl">{RELIC_DATA[myRelicId].icon}</span> <span className="text-xs text-gray-300">{RELIC_DATA[myRelicId].desc.slice(0, 10)}...</span> </div> )}
            <div className="text-3xl font-bold flex items-center gap-2">
              {Math.max(0, board[`${prefix}_hp`])} HP
              {board[`${prefix}_block`] > 0 && <span className="text-xl bg-blue-600 px-2 rounded-full">🛡️{board[`${prefix}_block`]}</span>}
              {myPoison > 0 && <span className="text-sm bg-purple-900 px-2 rounded">☠️{myPoison}</span>}
              {myStun && <span className="text-sm bg-yellow-600 px-2 rounded animate-pulse">⚡STAN</span>}
              {myVulnerable && <span className="text-sm bg-red-600 px-2 rounded animate-pulse">💔脆弱</span>}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="text-xs font-bold text-purple-400">LIMIT</div>
              <div className="w-32 h-4 bg-gray-800 rounded relative border border-gray-600 overflow-hidden"> <div className={`h-full transition-all duration-300 ${mySpecial >= 100 ? 'bg-purple-500 animate-pulse shadow-[0_0_10px_purple]' : 'bg-purple-900'}`} style={{ width: `${mySpecial}%` }} /> </div>
              {mySpecial >= 100 && isMyTurn && !result && ( <button onClick={() => setShowMiniGame(true)} className="px-3 py-1 bg-purple-600 text-white font-bold text-xs rounded animate-bounce shadow-[0_0_15px_purple] hover:scale-110">🔥必殺!</button> )}
            </div>
          </div>
          <div className="flex gap-1 absolute bottom-full right-0 mb-2"> {EMOTES.map(e => <button key={e} onClick={() => sendEmote(e)} className="text-xl bg-gray-800 hover:bg-gray-700 rounded p-1 shadow border border-gray-600">{e}</button>)} </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 min-h-[140px] items-end">
          {myHand.map((card: any, index: number) => {
            const isRare = card.id.startsWith('slot') || card.id === 'm-fire';
            const isRankUp = card.rank === 2;
            return (
            <button key={`${card.id}-${index}`} onClick={() => playCard(card, index)} disabled={!isMyTurn || board[`${prefix}_energy`] < card.cost || result !== null}
              className={`flex-shrink-0 w-24 h-32 rounded-lg border-2 flex flex-col items-center justify-between p-1 transition-all relative 
              ${isRare ? 'holo-card-bg' : ''} 
              ${isRankUp ? 'rank-up-card' : ''} 
              ${!isMyTurn || result ? 'bg-gray-900 opacity-50' : board[`${prefix}_energy`] < card.cost ? 'bg-gray-800 grayscale' : isRare ? '' : card.effect === 'poison' ? 'bg-purple-950 border-purple-400' : card.effect === 'stun' ? 'bg-yellow-950 border-yellow-400' : card.type === 'attack' ? 'bg-red-950 border-red-500 hover:-translate-y-2' : 'bg-blue-950 border-blue-400 hover:-translate-y-2'}`}>
              <div className="absolute -top-2 -left-2 w-6 h-6 bg-yellow-500 text-black rounded-full flex items-center justify-center font-bold text-xs border border-white">{card.cost}</div>
              <div className="font-bold text-xs mt-2 z-10">{card.name}</div>
              <div className="text-[10px] text-gray-300 text-center leading-tight z-10">{card.desc}</div>
              <div className={`text-lg font-black z-10 ${card.id.startsWith('slot') ? 'text-yellow-400 text-2xl' : card.effect ? 'text-green-400' : card.type === 'attack' ? 'text-red-400' : 'text-blue-400'}`}> {card.id.startsWith('slot') ? '🎰' : card.type === 'attack' ? `⚔️${card.val}` : `🛡️${card.val}`} </div>
            </button>
          )})}
        </div>
      </div>
    </div>
  );
}

export default function PvpBattle() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
      <PvpBattleContent />
    </Suspense>
  );
}