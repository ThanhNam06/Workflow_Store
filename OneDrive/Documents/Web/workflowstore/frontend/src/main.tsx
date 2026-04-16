import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Checkout from './app/pages/Checkout'
import { Login } from './app/pages/Login'
import { CategoryDetail } from './app/pages/CategoryDetail'
import { AuthProvider } from './app/store/AuthContext'

import './styles/tailwind.css'

function App(){
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<div>Home (placeholder)</div>} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/login" element={<Login />} />
          <Route path="/:platform/:category" element={<CategoryDetail/>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
