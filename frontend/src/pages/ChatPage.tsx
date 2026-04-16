import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Send, Bot, User, Loader2, AlertTriangle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { formatDistanceToNow } from 'date-fns'
import { agentsApi } from '../api/agents'
import type { ChatMessage } from '../types'

export default function ChatPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialSessionId = searchParams.get('session') ?? ''

  const [sessionId, setSessionId] = useState(initialSessionId)
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

  // Load existing session messages
  useEffect(() => {
    if (sessionId) {
      agentsApi.listSessions(id!).then(data => {
        const sess = data.data.find(s => s.id === sessionId)
        if (sess) setMessages(sess.messages ?? [])
      })
    }
  }, [sessionId, id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    setIsStreaming(true)
    setStreamingContent('')

    // Optimistic user message
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
        body: JSON.stringify({
          user_input: text,
          user_id: 'user',
          session_id: sessionId,
        }),
      })

      if (!res.ok) throw new Error('Chat request failed')

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let finalMsg: ChatMessage | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
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
          } catch { /* ignore parse errors */ }
        }
      }

      setMessages(prev => [
        ...prev,
        finalMsg ?? {
          id: crypto.randomUUID(),
          role: 'assistant',
          name: agent?.name ?? 'Assistant',
          content: fullContent,
          timestamp: new Date().toISOString(),
        },
      ])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          name: 'System',
          content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setIsStreaming(false)
      setStreamingContent('')
      inputRef.current?.focus()
    }
  }, [input, isStreaming, id, sessionId, agent])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!agent) return <div className="p-8 text-slate-500">Loading...</div>

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur shrink-0">
        <button className="btn-ghost p-1.5" onClick={() => navigate(`/agents/${id}`)}>
          <ArrowLeft size={16} />
        </button>
        <div className="w-8 h-8 rounded-lg bg-brand-900/50 border border-brand-800/50 flex items-center justify-center shrink-0">
          <Bot size={15} className="text-brand-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-100 text-sm">{agent.name}</p>
          <p className="text-xs text-slate-500">
            {agent.status === 'running' ? (
              <span className="text-emerald-400">Online</span>
            ) : (
              <span className="text-amber-400">Simulated (agent not running)</span>
            )}
            {sessionId && <> · Session {sessionId.slice(0, 8)}...</>}
          </p>
        </div>
      </div>

      {agent.status !== 'running' && (
        <div className="mx-6 mt-4 p-3 rounded-lg bg-amber-900/20 border border-amber-800/50 flex items-center gap-2 text-amber-400 text-sm">
          <AlertTriangle size={14} />
          Agent is not running. Responses will be simulated. Start the agent for real AI responses.
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-brand-900/30 border border-brand-800/50 flex items-center justify-center mb-4">
              <Bot size={28} className="text-brand-400" />
            </div>
            <h3 className="text-slate-300 font-semibold mb-1">Chat with {agent.name}</h3>
            <p className="text-slate-600 text-sm">Send a message to start the conversation</p>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} agentName={agent.name} />
        ))}

        {isStreaming && streamingContent && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-900/50 border border-brand-800/50 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-brand-400" />
            </div>
            <div className="flex-1 bg-slate-800/50 rounded-2xl rounded-tl-sm px-4 py-3 max-w-2xl">
              <ReactMarkdown className="prose prose-invert prose-sm max-w-none text-slate-300">
                {streamingContent}
              </ReactMarkdown>
              <Loader2 size={12} className="animate-spin text-brand-400 mt-2" />
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-900/50 border border-brand-800/50 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-brand-400" />
            </div>
            <div className="bg-slate-800/50 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 shrink-0">
        <div className="flex gap-3 items-end max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            className="input flex-1 resize-none max-h-40 min-h-[44px]"
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
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
      </div>
    </div>
  )
}

function MessageBubble({ msg, agentName }: { msg: ChatMessage; agentName: string }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isUser ? 'bg-slate-700 border border-slate-600' : 'bg-brand-900/50 border border-brand-800/50'
      }`}>
        {isUser ? <User size={14} className="text-slate-300" /> : <Bot size={14} className="text-brand-400" />}
      </div>
      <div className={`max-w-2xl ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <span className="text-[10px] text-slate-600 px-1">
          {isUser ? 'You' : agentName} ·{' '}
          {formatDistanceToNow(new Date(msg.timestamp))} ago
        </span>
        <div className={`px-4 py-3 rounded-2xl text-sm ${
          isUser
            ? 'bg-brand-600 text-white rounded-tr-sm'
            : 'bg-slate-800/50 text-slate-200 rounded-tl-sm'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <ReactMarkdown className="prose prose-invert prose-sm max-w-none">
              {msg.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  )
}
