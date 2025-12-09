// app/page.tsx
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-red-500 to-purple-600 bg-clip-text text-transparent">
        SLAY THE NEXT
      </h1>
      <p className="text-xl text-gray-400 mb-8">デッキ構築型ローグライク</p>
      
      <Link href="/game" className="px-8 py-4 bg-white text-black font-bold text-xl rounded hover:bg-gray-200 transition-transform hover:scale-105 active:scale-95">
        ゲームスタート
      </Link>
    </div>
  );
}