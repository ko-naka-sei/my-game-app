'use client';
import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// ------------------------------------------------
// 🎴 ジョブごとのデッキ定義 (そのまま)
// ------------------------------------------------
const JOB_DECKS: any = {
  warrior: [
    { id: 'w-bash', name: 'シールドバッシュ', val: 5, cost: 2, type: 'attack', effect: 'stun', desc: '5ダメ+スタン' },
    { id: 'w-smash', name: '強打', val: 12, cost: 2, type: 'attack', desc: '12ダメージ' },
    { id: 'w-slash-1', name: '斬撃', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
    { id: 'w-slash-2', name: '斬撃', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
    { id: 'w-slash-3', name: '斬撃', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
    { id: 'w-slash-4', name: '斬撃', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
    { id: 'w-slash-5', name: '斬撃', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
    { id: 'w-def-1', name: '鉄壁', val: 10, cost: 2, type: 'skill', desc: 'ブロック+10' },
    { id: 'w-def-2', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'w-def-3', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'w-def-4', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'w-def-5', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'w-def-6', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'w-def-7', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'w-res', name: '休息', val: 5, cost: 1, type: 'skill', effect: 'heal', desc: '5回復' },
  ],
  mage: [
    { id: 'm-poison-1', name: '毒の霧', val: 3, cost: 1, type: 'skill', effect: 'poison', desc: '毒+3' },
    { id: 'm-poison-2', name: '毒の霧', val: 3, cost: 1, type: 'skill', effect: 'poison', desc: '毒+3' },
    { id: 'm-fire', name: 'ファイア', val: 15, cost: 2, type: 'attack', desc: '15ダメージ' },
    { id: 'm-drain', name: 'ドレイン', val: 5, cost: 1, type: 'attack', effect: 'heal', desc: '5ダメ+5回復' },
    { id: 'm-atk-1', name: '杖攻撃', val: 4, cost: 1, type: 'attack', desc: '4ダメージ' },
    { id: 'm-atk-2', name: '杖攻撃', val: 4, cost: 1, type: 'attack', desc: '4ダメージ' },
    { id: 'm-atk-3', name: '杖攻撃', val: 4, cost: 1, type: 'attack', desc: '4ダメージ' },
    { id: 'm-atk-4', name: '杖攻撃', val: 4, cost: 1, type: 'attack', desc: '4ダメージ' },
    { id: 'm-bar-1', name: '魔法バリア', val: 8, cost: 2, type: 'skill', desc: 'ブロック+8' },
    { id: 'm-def-1', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'm-def-2', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'm-def-3', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'm-def-4', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'm-def-5', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'm-def-6', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
  ],
  gambler: [
    { id: 'slot-1', name: '運命のスロット', val: 0, cost: 2, type: 'skill', desc: '777で即死、💀で破滅' },
    { id: 'slot-2', name: '運命のスロット', val: 0, cost: 2, type: 'skill', desc: '777で即死、💀で破滅' },
    { id: 'slot-3', name: '運命のスロット', val: 0, cost: 2, type: 'skill', desc: '777で即死、💀で破滅' },
    { id: 'g-atk-1', name: 'ストライク', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
    { id: 'g-atk-2', name: 'ストライク', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
    { id: 'g-atk-3', name: 'ストライク', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
    { id: 'g-atk-4', name: 'ストライク', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
    { id: 'g-atk-5', name: 'ストライク', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
    { id: 'g-atk-6', name: 'ストライク', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
    { id: 'g-def-1', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'g-def-2', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'g-def-3', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'g-def-4', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'g-def-5', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'g-def-6', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
  ]
};

const RELICS = [
  { id: 'vampire_fang', icon: '🧛', name: '吸血の牙', desc: '攻撃でダメージを与えるとHPが1回復' },
  { id: 'titan_shield', icon: '🛡️', name: '巨人の盾', desc: 'ターン開始時にブロック+3' },
  { id: 'energy_ring', icon: '💍', name: '活気の指輪', desc: 'HPが20以下の時、ターン開始時のエナジー+1' },
  { id: 'lucky_coin', icon: '🪙', name: '幸運のコイン', desc: 'スロットで777が出る確率が2倍になる' },
];

function PvpLobbyContent() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [selectedJob, setSelectedJob] = useState<'warrior' | 'mage' | 'gambler'>('warrior');

  const shuffle = (array: any[]) => {
    const newArr = JSON.parse(JSON.stringify(array));
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  const getRandomRelicId = () => RELICS[Math.floor(Math.random() * RELICS.length)].id;

  const createRoom = async () => {
    if (!roomId || !playerName) return alert('全て入力してください');
    const myDeckFull = shuffle(JOB_DECKS[selectedJob]);
    const dummyDeck = shuffle(JOB_DECKS['warrior']);
    const initialState = {
      turn: 'p1', last_action: 'ゲーム開始',
      p1_name: playerName, p1_job: selectedJob, p1_relic: getRandomRelicId(),
      p1_hp: 50, p1_energy: 3, p1_block: 0, p1_special: 0,
      p1_poison: 0, p1_stun: false, p1_emote: '',
      p1_deck: myDeckFull, p1_hand: myDeckFull.splice(0, 5), p1_discard: [],
      p2_name: 'Waiting...', p2_job: 'warrior', p2_relic: getRandomRelicId(),
      p2_hp: 50, p2_energy: 3, p2_block: 0, p2_special: 0,
      p2_poison: 0, p2_stun: false, p2_emote: '',
      p2_deck: dummyDeck, p2_hand: dummyDeck.splice(0, 5), p2_discard: [],
    };
    const { error } = await (supabase.from('battle_room') as any).insert({
      id: roomId, player1: playerName, boardState: initialState
    });
    if (error) alert('エラー: ' + error.message);
    else router.push(`/pvp/${roomId}?player=p1&name=${playerName}`);
  };

  const joinRoom = async () => {
    if (!roomId || !playerName) return alert('全て入力してください');
    const myDeckFull = shuffle(JOB_DECKS[selectedJob]);
    const myHand = myDeckFull.splice(0, 5);
    const myRelic = getRandomRelicId();
    const { error } = await (supabase.from('battle_room') as any).update({ player2: playerName }).eq('id', roomId);
    if (error) { alert('部屋が見つかりません'); return; }
    const { data } = await (supabase.from('battle_room') as any).select('boardState').eq('id', roomId).single();
    if(data) {
       const newState = data.boardState;
       newState.p2_name = playerName;
       newState.p2_job = selectedJob;
       newState.p2_relic = myRelic;
       newState.p2_deck = myDeckFull;
       newState.p2_hand = myHand;
       newState.p2_discard = [];
       newState.p2_hp = 50; newState.p2_energy = 3; newState.p2_block = 0; newState.p2_special = 0;
       newState.p2_poison = 0; newState.p2_stun = false; newState.p2_emote = '';
       await (supabase.from('battle_room') as any).update({ boardState: newState }).eq('id', roomId);
    }
    router.push(`/pvp/${roomId}?player=p2&name=${playerName}`);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-6 text-yellow-500 animate-pulse">⚔️ SLAY THE NEXT</h1>
      <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md flex flex-col gap-4 border border-gray-700 shadow-xl">
        <div><label className="text-xs text-gray-400">プレイヤー名</label><input type="text" placeholder="名前" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full p-3 rounded bg-gray-700 text-white font-bold border border-gray-600" /></div>
        <div>
          <label className="text-xs text-gray-400">ジョブ選択</label>
          <div className="flex gap-2 mt-1">
            <button onClick={() => setSelectedJob('warrior')} className={`flex-1 py-3 rounded border-2 transition-all ${selectedJob === 'warrior' ? 'bg-red-900 border-red-500' : 'bg-gray-700 grayscale'}`}>⚔️ 戦士</button>
            <button onClick={() => setSelectedJob('mage')} className={`flex-1 py-3 rounded border-2 transition-all ${selectedJob === 'mage' ? 'bg-purple-900 border-purple-500' : 'bg-gray-700 grayscale'}`}>🧙‍♂️ 魔導士</button>
            <button onClick={() => setSelectedJob('gambler')} className={`flex-1 py-3 rounded border-2 transition-all ${selectedJob === 'gambler' ? 'bg-yellow-900 border-yellow-500' : 'bg-gray-700 grayscale'}`}>🎰 博徒</button>
          </div>
        </div>
        <div><label className="text-xs text-gray-400">部屋ID</label><input type="text" placeholder="※新しい番号を使ってください！" value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-full p-3 rounded bg-gray-700 text-white font-bold border border-gray-600" /></div>
        <div className="flex gap-4 mt-2"><button onClick={createRoom} className="flex-1 bg-blue-600 py-3 rounded font-bold">作成 (P1)</button><button onClick={joinRoom} className="flex-1 bg-green-600 py-3 rounded font-bold">参加 (P2)</button></div>
      </div>
    </div>
  );
}

// ★ Suspenseでラップする (これがエラーの修正箇所)
export default function PvpLobby() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
      <PvpLobbyContent />
    </Suspense>
  );
}