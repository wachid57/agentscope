import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Send, Bot, User, Loader2, AlertTriangle, SquarePen } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { formatDistanceToNow } from 'date-fns'
import { agentsApi } from '../api/agents'
import type { ChatMessage } from '../types'
import { useNavActions } from '../context/NavActions'
import { useSetNavSubtitle } from '../context/NavSubtitle'

export default function ChatPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [sessionId, setSessionId] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { data: agent } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => agentsApi.get(id!),
    enabled: !!id,
  })

  const isOnline = agent?.status === 'running'

  useSetNavSubtitle(agent ? (isOnline ? 'Online' : 'Offline') : '')

  const { setActions } = useNavActions()
  useEffect(() => {
    if (!agent) return
    setActions(
      <div className="flex items-center gap-2">
        {/* Agent info */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: '#eff6ff' }}>
            <Bot size={13} className="text-brand-600" />
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{agent.name}</span>
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
        </div>

        <div className="w-px h-5" style={{ background: 'var(--border-strong)' }} />

        {/* New chat */}
        <button
          className="btn-outline text-xs py-1.5"
          onClick={() => { setMessages([]); setSessionId(''); setInput('') }}
          title="New conversation"
        >
          <SquarePen size={13} /> New Chat
        </button>

        {/* Back */}
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
  }, [input, isStreaming, id, sessionId, agent])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  if (!agent) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 size={20} className="animate-spin text-brand-500" />
    </div>
  )

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>

      {/* Warning banner */}
      {!isOnline && (
        <div className="mx-6 mt-4 p-3 rounded-lg flex items-center gap-2 text-sm shrink-0"
          style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309' }}>
          <AlertTriangle size={14} />
          Agent is not running. Start the agent for real AI responses.
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">

          {/* Empty state */}
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-card"
                style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <Bot size={28} className="text-brand-500" />
              </div>
              <h3 className="font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
                Chat with {agent.name}
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Send a message to start the conversation
              </p>
            </div>
          )}

          {/* Messages */}
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} agentName={agent.name} />
          ))}

          {/* Streaming bubble */}
          {isStreaming && streamingContent && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <Bot size={14} className="text-brand-500" />
              </div>
              <div className="flex-1 rounded-2xl rounded-tl-sm px-4 py-3 max-w-2xl shadow-card"
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
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <Bot size={14} className="text-brand-500" />
              </div>
              <div className="rounded-2xl rounded-tl-sm px-4 py-3 shadow-card"
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

      {/* Input bar */}
      <div className="shrink-0 border-t px-6 py-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <textarea
            ref={inputRef}
            className="input flex-1 resize-none max-h-40 min-h-[44px]"
            placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isStreaming}
          />
          <button
            className="btn-primary shrink-0 h-11 w-11 p-0 justify-center"
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
          >
            {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        {sessionId && (
          <p className="text-center text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
            Session {sessionId.slice(0, 8)}…
          </p>
        )}
      </div>
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, agentName }: { msg: ChatMessage; agentName: string }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={isUser
          ? { background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }
          : { background: '#eff6ff', border: '1px solid #bfdbfe' }
        }>
        {isUser
          ? <User size={14} style={{ color: 'var(--text-secondary)' }} />
          : <Bot size={14} className="text-brand-500" />
        }
      </div>

      <div className={`max-w-2xl flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <span className="text-[10px] px-1" style={{ color: 'var(--text-muted)' }}>
          {isUser ? 'You' : agentName} · {formatDistanceToNow(new Date(msg.timestamp))} ago
        </span>
        <div className={`px-4 py-3 rounded-2xl text-sm shadow-card ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
          style={isUser
            ? { background: '#2563eb', color: '#fff' }
            : { background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
          }>
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
