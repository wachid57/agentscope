import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send, Bot, User, Loader2, AlertTriangle, SquarePen, MessageSquare, Trash2, Clock } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { formatDistanceToNow, format } from 'date-fns'
import { agentsApi } from '../api/agents'
import type { ChatMessage, Session } from '../types'
import { useNavActions } from '../context/NavActions'
import { useSetNavSubtitle } from '../context/NavSubtitle'

export default function ChatPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [sessionId, setSessionId] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { data: agent } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => agentsApi.get(id!),
    enabled: !!id,
  })

  const { data: sessionsData, refetch: refetchSessions } = useQuery({
    queryKey: ['sessions', id],
    queryFn: () => agentsApi.listSessions(id!),
    enabled: !!id,
    refetchInterval: 10000,
  })
  const sessions: Session[] = sessionsData?.data ?? []

  const isOnline = agent?.status === 'running'
  useSetNavSubtitle(agent ? (isOnline ? 'Online' : 'Offline') : '')

  const { setActions } = useNavActions()
  useEffect(() => {
    if (!agent) return
    setActions(
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: '#eff6ff' }}>
            <Bot size={13} className="text-brand-600" />
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{agent.name}</span>
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
        </div>
        <div className="w-px h-5" style={{ background: 'var(--border-strong)' }} />
        <button className="btn-outline text-xs py-1.5" onClick={startNewChat} title="New conversation">
          <SquarePen size={13} /> New Chat
        </button>
        <button className="btn-ghost text-xs py-1.5" onClick={() => navigate(`/agents/${id}`)}>
          <ArrowLeft size={13} /> Back
        </button>
      </div>
    )
    return () => setActions(null)
  }, [agent, isOnline, id, navigate, setActions])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const startNewChat = useCallback(() => {
    setMessages([])
    setSessionId('')
    setInput('')
    setStreamingContent('')
  }, [])

  const loadSession = useCallback((sess: Session) => {
    setSessionId(sess.id)
    setMessages(sess.messages ?? [])
    setInput('')
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    setIsStreaming(true)
    setStreamingContent('')

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      name: 'You',
      content: text,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])

    try {
      const res = await fetch(`/api/agents/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_input: text, user_id: 'user', session_id: sessionId }),
      })

      if (!res.ok) throw new Error('Chat request failed')

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let finalMsg: ChatMessage | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') continue
          try {
            const data = JSON.parse(raw)
            if (data.done && data.message) {
              finalMsg = data.message
              if (data.session_id && !sessionId) setSessionId(data.session_id)
            } else if (data.content) {
              fullContent += data.content
              setStreamingContent(fullContent)
            }
          } catch { /* ignore */ }
        }
      }

      setMessages(prev => [...prev, finalMsg ?? {
        id: crypto.randomUUID(),
        role: 'assistant',
        name: agent?.name ?? 'Assistant',
        content: fullContent,
        timestamp: new Date().toISOString(),
      }])
      refetchSessions()
    } catch (err) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        name: 'System',
        content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setIsStreaming(false)
      setStreamingContent('')
      inputRef.current?.focus()
    }
  }, [input, isStreaming, id, sessionId, agent, refetchSessions])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  if (!agent) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 size={20} className="animate-spin text-brand-500" />
    </div>
  )

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* ── Sidebar: Session History ── */}
      <aside className={`shrink-0 flex flex-col border-r transition-all duration-200 ${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'}`}
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>

        {/* Sidebar header */}
        <div className="px-4 pt-4 pb-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Riwayat Chat
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            {sessions.length}
          </span>
        </div>

        {/* New chat button */}
        <div className="px-3 pt-3 pb-2">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{ background: 'var(--brand-600, #2563eb)', color: 'white' }}
          >
            <SquarePen size={13} /> New Chat
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <MessageSquare size={20} className="mb-2 opacity-30" style={{ color: 'var(--text-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Belum ada riwayat chat</p>
            </div>
          ) : (
            sessions.map(sess => {
              const isActive = sess.id === sessionId
              const lastMsg = sess.messages?.[sess.messages.length - 1]
              const preview = lastMsg?.content?.slice(0, 60) ?? 'No messages'
              return (
                <button
                  key={sess.id}
                  onClick={() => loadSession(sess)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all group ${isActive ? 'ring-1' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                  style={isActive ? {
                    background: 'var(--brand-50, #eff6ff)',
                    border: '1px solid var(--brand-200, #bfdbfe)',
                  } : {}}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare size={12} className={`mt-0.5 shrink-0 ${isActive ? 'text-brand-500' : ''}`}
                      style={!isActive ? { color: 'var(--text-muted)' } : {}} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: isActive ? 'var(--brand-700, #1d4ed8)' : 'var(--text-primary)' }}>
                        {sess.messages?.[0]?.content?.slice(0, 35) ?? 'Session ' + sess.id.slice(0, 6)}
                      </p>
                      <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{preview}…</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock size={9} style={{ color: 'var(--text-muted)' }} />
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {formatDistanceToNow(new Date(sess.updated_at))} ago
                        </span>
                        <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>
                          {sess.messages?.length ?? 0} msg
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* ── Main chat area ── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Sidebar toggle + warning */}
        <div className="shrink-0">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-4 h-8 flex items-center justify-center rounded-r-md border border-l-0 transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--text-muted)' }}
            title={sidebarOpen ? 'Hide history' : 'Show history'}
          >
            <span className="text-[10px] font-bold">{sidebarOpen ? '‹' : '›'}</span>
          </button>

          {!isOnline && (
            <div className="mx-4 mt-3 p-3 rounded-lg flex items-center gap-2 text-sm"
              style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309' }}>
              <AlertTriangle size={14} />
              Agent is not running. Start the agent for real AI responses.
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">

            {/* Empty state */}
            {messages.length === 0 && !isStreaming && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
                  style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <Bot size={28} className="text-brand-500" />
                </div>
                <h3 className="font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
                  Chat dengan {agent.name}
                </h3>
                <p className="text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>
                  Kirim pesan untuk memulai percakapan. Riwayat chat tersimpan di panel kiri.
                </p>
              </div>
            )}

            {/* Date separator helper */}
            {messages.map((msg, i) => {
              const showDate = i === 0 || format(new Date(msg.timestamp), 'yyyy-MM-dd') !== format(new Date(messages[i - 1].timestamp), 'yyyy-MM-dd')
              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex items-center gap-3 my-2">
                      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                        {format(new Date(msg.timestamp), 'd MMM yyyy')}
                      </span>
                      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                    </div>
                  )}
                  <MessageBubble msg={msg} agentName={agent.name} />
                </div>
              )
            })}

            {/* Streaming */}
            {isStreaming && streamingContent && (
              <div className="flex gap-3">
                <AgentAvatar />
                <div className="flex-1 rounded-2xl rounded-tl-sm px-4 py-3 max-w-2xl"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                  <ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert">
                    {streamingContent}
                  </ReactMarkdown>
                  <div className="flex gap-1 mt-2">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Typing indicator */}
            {isStreaming && !streamingContent && (
              <div className="flex gap-3">
                <AgentAvatar />
                <div className="rounded-2xl rounded-tl-sm px-4 py-3"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                  <div className="flex gap-1 items-center h-5">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-2 h-2 rounded-full animate-bounce"
                        style={{ background: 'var(--text-muted)', animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Input bar ── */}
        <div className="shrink-0 border-t px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2 items-end rounded-xl border p-2 transition-all focus-within:ring-2 focus-within:ring-brand-400/30"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}>
              <textarea
                ref={inputRef}
                className="flex-1 bg-transparent resize-none max-h-40 min-h-[36px] text-sm outline-none py-1 px-2"
                style={{ color: 'var(--text-primary)' }}
                placeholder="Ketik pesan… (Enter kirim, Shift+Enter baris baru)"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isStreaming}
              />
              <button
                className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
                style={{ background: input.trim() && !isStreaming ? 'var(--brand-600, #2563eb)' : 'var(--bg-elevated)', color: input.trim() && !isStreaming ? 'white' : 'var(--text-muted)' }}
                onClick={sendMessage}
                disabled={isStreaming || !input.trim()}
              >
                {isStreaming ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1">
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {sessionId ? `Session ${sessionId.slice(0, 8)}…` : 'Sesi baru'}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {messages.filter(m => m.role === 'user').length} pesan terkirim
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function AgentAvatar() {
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
      style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
      <Bot size={14} className="text-brand-500" />
    </div>
  )
}

function MessageBubble({ msg, agentName }: { msg: ChatMessage; agentName: string }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={isUser
          ? { background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }
          : { background: '#eff6ff', border: '1px solid #bfdbfe' }}>
        {isUser
          ? <User size={14} style={{ color: 'var(--text-secondary)' }} />
          : <Bot size={14} className="text-brand-500" />}
      </div>

      <div className={`max-w-[70%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <span className="text-[10px] px-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          <span className="font-medium">{isUser ? 'Kamu' : agentName}</span>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(msg.timestamp))} yang lalu</span>
        </span>
        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
          style={isUser
            ? { background: 'var(--brand-600, #2563eb)', color: '#fff' }
            : { background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert">
              {msg.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  )
}
