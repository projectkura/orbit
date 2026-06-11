import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface TocItem {
  id: string
  text: string
  level: number
}

interface DocsTocProps {
  contentRef: React.RefObject<HTMLDivElement | null>
}

export function DocsToc({ contentRef }: DocsTocProps) {
  const [headings, setHeadings] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState<string>("")
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    if (!contentRef.current) return

    const elements = Array.from(contentRef.current.querySelectorAll("h2, h3"))
    const items: TocItem[] = elements.map((el) => ({
      id: el.id,
      text: el.textContent?.replace(/^#\s*/, "") ?? "",
      level: parseInt(el.tagName[1]),
    }))
    setHeadings(items)

    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
            break
          }
        }
      },
      { rootMargin: "-80px 0% -60% 0%", threshold: 1 },
    )

    for (const el of elements) {
      if (el.id) observerRef.current.observe(el)
    }

    return () => observerRef.current?.disconnect()
  }, [contentRef])

  if (headings.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        On this page
      </p>
      {headings.map((heading) => (
        <a
          key={heading.id}
          href={`#${heading.id}`}
          onClick={(e) => {
            e.preventDefault()
            document.getElementById(heading.id)?.scrollIntoView({ behavior: "smooth" })
            setActiveId(heading.id)
          }}
          className={cn(
            "text-sm transition-colors duration-150 py-0.5 leading-snug",
            heading.level === 3 && "pl-3",
            heading.level === 4 && "pl-6",
            activeId === heading.id
              ? "font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {heading.text}
        </a>
      ))}
    </div>
  )
}
