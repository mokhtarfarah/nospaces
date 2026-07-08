import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// Lets a route's screen (TasteScreen) hand a small chunk of JSX — its
// profile/desert-island sub-tabs — up to BottomNav, which renders outside the
// <Routes> tree in App.tsx and has no other channel to reach it. Things doesn't
// need this: its bottom bar (ThingsNav) lives in the same file as its taste
// tabs, so it just passes the content down as a normal prop.
type SubNavCtx = { content: ReactNode | null; setContent: (c: ReactNode | null) => void }
const Ctx = createContext<SubNavCtx | null>(null)

export function SubNavProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null)
  return <Ctx.Provider value={{ content, setContent }}>{children}</Ctx.Provider>
}

export function useSubNavContent() {
  return useContext(Ctx)?.content ?? null
}

// Screen-side: register a sub-row while this content is truthy, clear it on
// unmount or when it goes back to null (e.g. the island empties out).
export function useSetSubNav(content: ReactNode | null) {
  const ctx = useContext(Ctx)
  useEffect(() => {
    ctx?.setContent(content)
    return () => ctx?.setContent(null)
  }, [content, ctx])
}
