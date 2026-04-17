import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const Ctx = createContext<{ subtitle: string; setSubtitle: (s: string) => void }>({
  subtitle: '',
  setSubtitle: () => {},
})

export function NavSubtitleProvider({ children }: { children: React.ReactNode }) {
  const [subtitle, setSubtitleState] = useState('')
  const setSubtitle = useCallback((s: string) => setSubtitleState(s), [])
  return <Ctx.Provider value={{ subtitle, setSubtitle }}>{children}</Ctx.Provider>
}

export const useNavSubtitle = () => useContext(Ctx)

export function useSetNavSubtitle(subtitle: string) {
  const { setSubtitle } = useNavSubtitle()
  useEffect(() => {
    setSubtitle(subtitle)
    return () => setSubtitle('')
  }, [subtitle, setSubtitle])
}
