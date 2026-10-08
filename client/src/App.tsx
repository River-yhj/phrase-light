import { Link, Route, Routes } from 'react-router'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import WordPage from './pages/WordPage'

export default function App() {
  return (
    <div className="layout">
      <header className="site-header">
        <Link to="/" className="brand">
          MuthoRoot
        </Link>
        <span className="tagline">단어에 얽힌 이야기</span>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/words/:id" element={<WordPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      {/* 모든 페이지 하단에 노출하는 디스클레이머 (decision-log: 서비스 컨셉) */}
      <footer className="site-footer">
        여기 실린 이야기는 검증된 학술 정보가 아니라 커뮤니티가 함께 만들어가는 설(說)입니다.
      </footer>
    </div>
  )
}
