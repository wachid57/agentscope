import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'

const Ctx = createContext<{
  actions: ReactNode
  setActions: (a: ReactNode) => void
}>({ actions: null, setActions: () => {} })

export function NavActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActionsState] = useState<ReactNode>(null)
  const setActions = useCallback((a: ReactNode) => setActionsState(a), [])
  return <Ctx.Provider value={{ actions, setActions }}>{children}</Ctx.Provider>
}

export const useNavActions = () => useContext(Ctx)

export function useSetNavActions(actions: ReactNode) {
  const { setActions } = useNavActions()
  useEffect(() => {
    setActions(actions)
    return () => setActions(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
