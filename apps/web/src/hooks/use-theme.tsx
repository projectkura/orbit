import { createContext, useCallback, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light"

interface ThemeContext {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContext | undefined>(undefined)

const STORAGE_KEY = "orbit-theme"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark"
    return (localStorage.getItem(STORAGE_KEY) as Theme) || "dark"
  })

  useEffect(() => {
    document.documentElement.classList.remove("dark", "light")
    document.documentElement.classList.add(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const toggleTheme = useCallback(() => setThemeState((t) => (t === "dark" ? "light" : "dark")), [])

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within a ThemeProvider")
  return context
}
