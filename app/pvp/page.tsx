'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ------------------------------------------------
// 🎴 ジョブごとのデッキ定義
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
  
  // ★ランキング & マッチング用ステート
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 初回ロード時にランキング取得
  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data } = await (supabase.from('profile') as any)
        .select('*')
        .order('combatPower', { ascending: false })
        .limit(10);
      if (data) setLeaderboard(data);
    };
    fetchLeaderboard();
  }, []);

  const shuffle = (array: any[]) => {
    const newArr = JSON.parse(JSON.stringify(array));
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  const getRandomRelicId = () => RELICS[Math.floor(Math.random() * RELICS.length)].id;

  // --- 部屋作成ロジック (引数でID指定可能に) ---
  const createRoom = async (targetId: string) => {
    if (!playerName) return alert('プレイヤー名を入力してください');
    
    // IDが指定されてなければ入力欄の値を使う
    const finalRoomId = targetId || roomId;
    if (!finalRoomId) return alert('部屋IDを入力するか、クイックプレイを押してください');

    const myDeckFull = shuffle(JOB_DECKS[selectedJob]);
    const dummyDeck = shuffle(JOB_DECKS['warrior']);

    const initialState = {
      turn: 'p1', turn_count: 1, weather: 'none', last_action: 'ゲーム開始',
      p1_name: playerName, p1_job: selectedJob, p1_relic: getRandomRelicId(),
      p1_hp: 50, p1_energy: 3, p1_block: 0, p1_special: 0,
      p1_poison: 0, p1_stun: false, p1_vulnerable: false, p1_emote: '',
      p1_deck: myDeckFull, p1_hand: myDeckFull.splice(0, 5), p1_discard: [],
      
      p2_name: 'Waiting...', p2_job: 'warrior', p2_relic: getRandomRelicId(),
      p2_hp: 50, p2_energy: 3, p2_block: 0, p2_special: 0,
      p2_poison: 0, p2_stun: false, p2_vulnerable: false, p2_emote: '',
      p2_deck: dummyDeck, p2_hand: dummyDeck.splice(0, 5), p2_discard: [],
    };

    const { error } = await (supabase.from('battle_room') as any).insert({
      id: finalRoomId, player1: playerName, boardState: initialState
    });

    if (error) alert('エラー(作成): ' + error.message);
    else router.push(`/pvp/${finalRoomId}?player=p1&name=${playerName}`);
  };

  // --- 部屋参加ロジック (引数でID指定可能に) ---
  const joinRoom = async (targetId: string) => {
    if (!playerName) return alert('プレイヤー名を入力してください');
    
    const finalRoomId = targetId || roomId;
    if (!finalRoomId) return alert('部屋IDを入力するか、クイックプレイを押してください');

    const myDeckFull = shuffle(JOB_DECKS[selectedJob]);
    const myHand = myDeckFull.splice(0, 5);
    const myRelic = getRandomRelicId();

    const { error } = await (supabase.from('battle_room') as any)
      .update({ player2: playerName }) 
      .eq('id', finalRoomId);

    if (error) { alert('部屋が見つかりません'); return; }

    const { data } = await (supabase.from('battle_room') as any).select('boardState').eq('id', finalRoomId).single();
    if(data) {
       const newState = data.boardState;
       newState.p2_name = playerName;
       newState.p2_job = selectedJob;
       newState.p2_relic = myRelic;
       newState.p2_deck = myDeckFull;
       newState.p2_hand = myHand;
       newState.p2_discard = [];
       newState.p2_hp = 50; newState.p2_energy = 3; newState.p2_block = 0; newState.p2_special = 0;
       newState.p2_poison = 0; newState.p2_stun = false; newState.p2_vulnerable = false; newState.p2_emote = '';
       
       await (supabase.from('battle_room') as any).update({ boardState: newState }).eq('id', finalRoomId);
    }
    router.push(`/pvp/${finalRoomId}?player=p2&name=${playerName}`);
  };

  // --- ★ランダムマッチング機能 ---
  // --- ★改良版：ランダムマッチング機能 ---
  const handleRandomMatch = async () => {
    if (!playerName) return alert('まずはプレイヤー名を入力してください！');
    setIsSearching(true);

    try {
      // 1分前 (60000ms) の時間を取得
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

      // 1. 「空き部屋」かつ「1分以内に作られた(生きてる)部屋」を探す
      const { data: waitingRooms } = await (supabase.from('battle_room') as any)
        .select('*')
        .is('player2', null) // 誰も入ってない
        .gt('updatedAt', oneMinuteAgo) // ★重要：1分以内に更新された部屋だけ！
        .order('updatedAt', { ascending: false })
        .limit(1);

      if (waitingRooms && waitingRooms.length > 0) {
        // 生きている部屋が見つかった -> 参加！
        const targetRoom = waitingRooms[0];
        console.log('生存部屋発見！参加します:', targetRoom.id);
        await joinRoom(targetRoom.id);
      } else {
        // 見つからない -> 自分で部屋を作って待つ
        const randomId = Math.random().toString(36).substring(2, 8);
        console.log('部屋を作成して待機します:', randomId);
        await createRoom(randomId);
      }
    } catch (e) {
      alert('マッチングエラーが発生しました');
      console.error(e);
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col md:flex-row gap-8 items-start justify-center">
      
      {/* 左側：入力フォーム */}
      <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md flex flex-col gap-4 border border-gray-700 shadow-xl">
        <h1 className="text-4xl font-bold mb-2 text-yellow-500 animate-pulse text-center">⚔️ SLAY THE NEXT</h1>
        
        <div>
          <label className="text-xs text-gray-400">プレイヤー名</label>
          <input type="text" placeholder="名前を入力" value={playerName} onChange={(e) => setPlayerName(e.target.value)}
            className="w-full p-3 rounded bg-gray-700 text-white font-bold border border-gray-600 focus:border-yellow-500 outline-none" />
        </div>

        <div>
          <label className="text-xs text-gray-400">ジョブ選択</label>
          <div className="flex gap-2 mt-1">
            <button onClick={() => setSelectedJob('warrior')} className={`flex-1 py-3 rounded border-2 transition-all ${selectedJob === 'warrior' ? 'bg-red-900 border-red-500 shadow-[0_0_10px_red]' : 'bg-gray-700 border-gray-600 grayscale'}`}><div className="text-2xl">⚔️</div><div className="text-xs font-bold">戦士</div></button>
            <button onClick={() => setSelectedJob('mage')} className={`flex-1 py-3 rounded border-2 transition-all ${selectedJob === 'mage' ? 'bg-purple-900 border-purple-500 shadow-[0_0_10px_purple]' : 'bg-gray-700 border-gray-600 grayscale'}`}><div className="text-2xl">🧙‍♂️</div><div className="text-xs font-bold">魔導士</div></button>
            <button onClick={() => setSelectedJob('gambler')} className={`flex-1 py-3 rounded border-2 transition-all ${selectedJob === 'gambler' ? 'bg-yellow-900 border-yellow-500 shadow-[0_0_10px_yellow]' : 'bg-gray-700 border-gray-600 grayscale'}`}><div className="text-2xl">🎰</div><div className="text-xs font-bold">博徒</div></button>
          </div>
        </div>

        {/* ★クイックプレイボタン */}
        <button 
          onClick={handleRandomMatch} 
          disabled={isSearching}
          className="w-full py-4 bg-gradient-to-r from-yellow-600 to-red-600 rounded font-black text-xl shadow-lg hover:scale-105 transition active:scale-95 disabled:opacity-50"
        >
          {isSearching ? '🔍 対戦相手を探しています...' : '⚔️ 今すぐ対戦 (クイックプレイ)'}
        </button>

        <div className="text-center text-gray-500 text-xs my-2">- OR -</div>

        {/* ID指定（友達と遊ぶ用） */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-400">部屋ID (友達と遊ぶ場合)</label>
            <input type="text" placeholder="例: 1234" value={roomId} onChange={(e) => setRoomId(e.target.value)}
              className="w-full p-2 rounded bg-gray-700 text-white font-bold border border-gray-600" />
          </div>
          <button onClick={() => createRoom(roomId)} className="bg-blue-600 px-4 py-2 rounded font-bold h-10 hover:bg-blue-500">作成</button>
          <button onClick={() => joinRoom(roomId)} className="bg-green-600 px-4 py-2 rounded font-bold h-10 hover:bg-green-500">参加</button>
        </div>
      </div>

      {/* ★右側：ランキングボード */}
      <div className="bg-gray-800 p-6 rounded-lg w-full max-w-sm border border-gray-700 shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-center text-blue-400">🏆 GLOBAL RANKING</h2>
        <div className="flex flex-col gap-2">
          {leaderboard.length === 0 ? (
            <div className="text-center text-gray-500 py-4">データ読み込み中...</div>
          ) : (
            leaderboard.map((user, index) => (
              <div key={user.user_id} className={`flex justify-between items-center p-3 rounded ${index === 0 ? 'bg-yellow-900/50 border border-yellow-500' : index === 1 ? 'bg-gray-700 border border-gray-400' : index === 2 ? 'bg-orange-900/50 border border-orange-600' : 'bg-gray-700/50'}`}>
                <div className="flex items-center gap-3">
                  <span className={`font-black text-xl w-6 text-center ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-orange-400' : 'text-gray-500'}`}>
                    {index + 1}
                  </span>
                  <div className="font-bold truncate max-w-[120px]">{user.name || user.user_id}</div>
                </div>
                <div className="font-mono text-yellow-300 font-bold">
                  {user.combatPower} <span className="text-xs text-gray-400">BP</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}

export default function PvpLobby() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
      <PvpLobbyContent />
    </Suspense>
  );
}