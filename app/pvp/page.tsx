'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// ------------------------------------------------
// 🎴 ジョブごとのデッキ定義
// ------------------------------------------------
const JOB_DECKS: any = {
  warrior: [
    { id: 'w-bash', name: 'シールドバッシュ', val: 5, cost: 2, type: 'attack', effect: 'stun', desc: '5ダメ+スタン(次ターンEN減)' },
    { id: 'w-smash', name: '強打', val: 12, cost: 2, type: 'attack', desc: '12ダメージ' },
    { id: 'atk-1', name: '斬撃', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
    { id: 'atk-2', name: '斬撃', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
    { id: 'def-1', name: '鉄壁', val: 10, cost: 2, type: 'skill', desc: 'ブロック+10' },
    { id: 'def-2', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'def-3', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
  ],
  mage: [
    { id: 'm-poison', name: '毒の霧', val: 3, cost: 1, type: 'skill', effect: 'poison', desc: '毒+3 (毎ターンDmg)' },
    { id: 'm-fire', name: 'ファイア', val: 15, cost: 2, type: 'attack', desc: '15ダメージ' },
    { id: 'm-drain', name: 'ドレイン', val: 5, cost: 1, type: 'attack', effect: 'heal', desc: '5ダメ+5回復' },
    { id: 'atk-1', name: '杖攻撃', val: 4, cost: 1, type: 'attack', desc: '4ダメージ' },
    { id: 'def-1', name: '魔法バリア', val: 8, cost: 2, type: 'skill', desc: 'ブロック+8' },
    { id: 'def-2', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'def-3', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
  ],
  gambler: [
    { id: 'slot-1', name: '運命のスロット', val: 0, cost: 0, type: 'skill', desc: '777で即死、💀で破滅' },
    { id: 'slot-2', name: '運命のスロット', val: 0, cost: 0, type: 'skill', desc: '777で即死、💀で破滅' },
    { id: 'atk-1', name: 'ストライク', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
    { id: 'atk-2', name: 'ストライク', val: 6, cost: 1, type: 'attack', desc: '6ダメージ' },
    { id: 'def-1', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'def-2', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
    { id: 'def-3', name: '防御', val: 5, cost: 1, type: 'skill', desc: 'ブロック+5' },
  ]
};

export default function PvpLobby() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [selectedJob, setSelectedJob] = useState<'warrior' | 'mage' | 'gambler'>('warrior');

  // シャッフル関数
  const shuffle = (array: any[]) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  const createRoom = async () => {
    if (!roomId || !playerName) return alert('全て入力してください');

    // 選んだジョブのデッキを使う
    const myDeckFull = shuffle([...JOB_DECKS[selectedJob]]);
    
    // 相手のデッキは仮で戦士にしておく（相手が入室時に上書きされる）
    const dummyDeck = shuffle([...JOB_DECKS['warrior']]);

    const initialState = {
      turn: 'p1', last_action: 'ゲーム開始',
      
      // Player 1 (自分)
      p1_name: playerName,
      p1_job: selectedJob,
      p1_hp: 50, p1_energy: 3, p1_block: 0, p1_special: 0,
      p1_poison: 0, p1_stun: false, p1_emote: '', // ★状態異常・エモート追加
      p1_deck: myDeckFull, p1_hand: myDeckFull.splice(0, 5), p1_discard: [],
      
      // Player 2 (相手)
      p2_name: 'Waiting...',
      p2_job: 'warrior', // 仮
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

    // 自分のデッキを作成
    const myDeckFull = shuffle([...JOB_DECKS[selectedJob]]);
    const myHand = myDeckFull.splice(0, 5);

    // 既存の部屋のデータを取得して、P2部分だけ自分のデータで上書きしたいが、
    // 複雑になるので今回は「入室時はDBの既存フィールドを更新」する簡易版
    // ※ 注意: 本当はトランザクションが必要ですが、簡易実装として
    //   「まず部屋に入ってから、自分のデッキデータを送信する」形にします。
    
    // Step 1: 名前だけ登録
    const { error } = await (supabase.from('battle_room') as any)
      .update({ player2: playerName }) 
      .eq('id', roomId);

    if (error) {
       alert('部屋が見つかりません');
       return;
    }

    // Step 2: 自分のデッキ情報を上書きするために、一度データを取得して更新
    // (これはバトル画面でやるのが安全ですが、ロビーでやっちゃいます)
    const { data } = await (supabase.from('battle_room') as any).select('boardState').eq('id', roomId).single();
    if(data) {
       const newState = data.boardState;
       newState.p2_name = playerName;
       newState.p2_job = selectedJob;
       newState.p2_deck = myDeckFull;
       newState.p2_hand = myHand;
       newState.p2_discard = [];
       // P2のステータスリセット
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
        {/* 名前入力 */}
        <div>
          <label className="text-xs text-gray-400">プレイヤー名</label>
          <input type="text" placeholder="名前" value={playerName} onChange={(e) => setPlayerName(e.target.value)}
            className="w-full p-3 rounded bg-gray-700 text-white font-bold border border-gray-600" />
        </div>

        {/* ジョブ選択 */}
        <div>
          <label className="text-xs text-gray-400">ジョブ選択</label>
          <div className="flex gap-2 mt-1">
            <button onClick={() => setSelectedJob('warrior')} className={`flex-1 py-3 rounded border-2 transition-all ${selectedJob === 'warrior' ? 'bg-red-900 border-red-500 shadow-[0_0_10px_red]' : 'bg-gray-700 border-gray-600 grayscale'}`}>
              <div className="text-2xl">⚔️</div>
              <div className="text-xs font-bold">戦士</div>
            </button>
            <button onClick={() => setSelectedJob('mage')} className={`flex-1 py-3 rounded border-2 transition-all ${selectedJob === 'mage' ? 'bg-purple-900 border-purple-500 shadow-[0_0_10px_purple]' : 'bg-gray-700 border-gray-600 grayscale'}`}>
              <div className="text-2xl">🧙‍♂️</div>
              <div className="text-xs font-bold">魔導士</div>
            </button>
            <button onClick={() => setSelectedJob('gambler')} className={`flex-1 py-3 rounded border-2 transition-all ${selectedJob === 'gambler' ? 'bg-yellow-900 border-yellow-500 shadow-[0_0_10px_yellow]' : 'bg-gray-700 border-gray-600 grayscale'}`}>
              <div className="text-2xl">🎰</div>
              <div className="text-xs font-bold">博徒</div>
            </button>
          </div>
          <div className="text-xs text-center mt-2 text-gray-300">
            {selectedJob === 'warrior' && '【戦士】スタン攻撃で相手の動きを封じる！'}
            {selectedJob === 'mage' && '【魔導士】毒でじわじわ削る＆回復魔法！'}
            {selectedJob === 'gambler' && '【博徒】運命のスロットで一発逆転！'}
          </div>
        </div>

        {/* 部屋ID */}
        <div>
          <label className="text-xs text-gray-400">部屋ID</label>
          <input type="text" placeholder="例: 1234" value={roomId} onChange={(e) => setRoomId(e.target.value)}
            className="w-full p-3 rounded bg-gray-700 text-white font-bold border border-gray-600" />
        </div>

        <div className="flex gap-4 mt-2">
          <button onClick={createRoom} className="flex-1 bg-blue-600 py-3 rounded font-bold hover:bg-blue-500">作成 (P1)</button>
          <button onClick={joinRoom} className="flex-1 bg-green-600 py-3 rounded font-bold hover:bg-green-500">参加 (P2)</button>
        </div>
      </div>
    </div>
  );
}