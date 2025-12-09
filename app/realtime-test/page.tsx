'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; // パス修正が必要な場合は ../../lib/supabase などに合わせてください

export default function RealtimePage() {
  const [message, setMessage] = useState('読み込み中...');
  const [lastUpdate, setLastUpdate] = useState('');

  // 1. リアルタイム監視のセットアップ
  useEffect(() => {
    // 初回データ取得
    const fetchInitialData = async () => {
      // ★修正: (supabase.from(...) as any) を使用
      const { data } = await (supabase.from('realtime_test') as any)
        .select('*')
        .eq('id', 'room-1')
        .single();
      
      if (data) {
        setMessage(data.message);
      } else {
        setMessage('データがありません。Supabaseでrowを作ってください');
      }
    };
    fetchInitialData();

    // ★ ここがリアルタイム通信の魔法 ★
    const channel = supabase
      .channel('test-channel')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', 
          schema: 'public',
          table: 'realtime_test',
          filter: 'id=eq.room-1',
        },
        (payload) => {
          console.log('変更検知！', payload);
          // ★修正: payload.new も any 型として扱う
          const newData = payload.new as any;
          setMessage(newData.message);
          setLastUpdate(new Date().toLocaleTimeString());
        }
      )
      .subscribe();

    // クリーンアップ
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 2. ボタンを押した時の処理
  const handlePress = async (btnName: string) => {
    const msg = `誰かが「${btnName}」を押しました！`;
    
    // ★修正: ここも (supabase.from(...) as any) を使用
    await (supabase.from('realtime_test') as any)
      .update({ message: msg })
      .eq('id', 'room-1');
  };

  return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>📡 リアルタイム通信の実験</h1>
      <p>PCとスマホで同時に開いてみてください</p>

      <div style={{ 
        margin: '30px auto', 
        padding: 30, 
        border: '3px solid #333', 
        borderRadius: 10,
        background: '#f0f0f0',
        fontSize: '24px',
        fontWeight: 'bold'
      }}>
        {message}
      </div>

      {lastUpdate && <p style={{color:'red'}}>更新時刻: {lastUpdate}</p>}

      <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
        <button 
          onClick={() => handlePress('🔴 赤ボタン')}
          style={{ padding: '20px 40px', fontSize: 20, background: '#ff4444', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer' }}
        >
          🔴 赤ボタン
        </button>

        <button 
          onClick={() => handlePress('🔵 青ボタン')}
          style={{ padding: '20px 40px', fontSize: 20, background: '#4444ff', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer' }}
        >
          🔵 青ボタン
        </button>
      </div>
    </div>
  );
}