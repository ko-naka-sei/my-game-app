// lib/supabase.ts

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

// 環境変数のチェック（読み込まれていなければエラーを出す親切設計）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL or Key is missing in .env file');
}

// 型定義<Database>を渡してクライアントを作成
export const supabase = createClient<Database>(supabaseUrl, supabaseKey);