import { useState, useEffect } from 'react'
import { create } from 'zustand'
import { User } from '../types/user'
import api from '../lib/api'

interface AuthStore {
  user: User | null
  initialized: boolean
  setUser: (user: User | null) => void
  setInitialized: (initialized: boolean) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  initialized: false,
  setUser: (user) => set({ user }),
  setInitialized: (initialized) => set({ initialized }),
}))

export function useAuth() {
  const { user, initialized, setUser, setInitialized } = useAuthStore()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialized) return

    setLoading(true)
    api.get('/api/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => {
        setInitialized(true)
        setLoading(false)
      })
  }, [initialized, setInitialized, setUser])

  async function login(identifier: string, password: string) {
    setLoading(true)
    try {
      const res = await api.post('/api/auth/login', { identifier, password })
      setUser(res.data.user)
      return res.data
    } finally {
      setLoading(false)
    }
  }

  async function signup(username: string, password: string, email?: string) {
    setLoading(true)
    try {
      const res = await api.post('/api/auth/signup', { username, password, email })
      setUser(res.data.user)
      return res.data
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    setLoading(true)
    try {
      await api.post('/api/auth/logout')
      setUser(null)
      setInitialized(true)
    } finally {
      setLoading(false)
    }
  }

  async function clearSession() {
    setLoading(true)
    try {
      setUser(null)
      setInitialized(true)
    } finally {
      setLoading(false)
    }
  }

  return { user, initialized, loading: loading || !initialized, login, signup, logout, clearSession }
}
