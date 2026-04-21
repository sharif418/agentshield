'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Code2, Copy, Check, Play, Zap, Terminal, Box, ArrowRight, Container } from 'lucide-react'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import tsx from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript'
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

SyntaxHighlighter.registerLanguage('typescript', tsx)
SyntaxHighlighter.registerLanguage('python', python)

const LANGUAGES = ['TypeScript', 'Python'] as const
type Language = (typeof LANGUAGES)[number]

const FRAMEWORKS = ['LangChain', 'CrewAI', 'AutoGen', 'OpenAI SDK'] as const
type Framework = (typeof FRAMEWORKS)[number]

const codeSnippets: Record<Language, Record<Framework, string>> = {
  TypeScript: {
    LangChain: `import { AgentShieldCallbackHandler } from '@agentshield/langchain';

// Create a callback handler with embedded policies
const handler = new AgentShieldCallbackHandler({
  mode: 'embedded',
  policies: [
    {
      policyId: 'POL-001',
      name: 'Block SQL DROP',
      agentRole: 'DataAgent',
      resource: 'PostgreSQL',
      action: 'DROP',
      permissionLevel: 'BLOCK',
      priority: 20,
      enabled: true,
    },
  ],
  toolNameMap: { 'sql_db_query': 'PostgreSQL' },
});

// Use with LangChain agent
const executor = AgentExecutor.fromAgentAndTools({
  agent,
  tools,
  callbacks: [handler],
});`,

    CrewAI: `import { AgentShield } from 'agentshield';

// Create a shield in hosted mode (connects to dashboard)
const shield = new AgentShield({
  mode: 'hosted',
  serverUrl: 'http://localhost:3000',
  apiKey: process.env.AGENTSHIELD_API_KEY,
});

// Add to your CrewAI agent callback
const agent = new Agent({
  name: 'DataAgent',
  role: 'Data Analysis Expert',
  async beforeToolCall(toolName, args) {
    const result = await shield.evaluate({
      agentRole: 'DataAgent',
      toolName,
      arguments: args,
    });

    if (result.decision === 'BLOCK') {
      return { blocked: true, reason: result.reason };
    }

    if (result.decision === 'REQUIRE_APPROVAL') {
      return { requireApproval: true, traceId: result.traceId };
    }

    return { allowed: true };
  },
});`,

    AutoGen: `import { AgentShield } from 'agentshield';

// Create a shield with embedded policies (no server needed)
const shield = new AgentShield({
  mode: 'embedded',
  policies: [
    {
      policyId: 'POL-001',
      name: 'Block SQL DROP',
      agentRole: 'DataAgent',
      resource: 'PostgreSQL',
      action: 'DROP',
      permissionLevel: 'BLOCK',
      priority: 20,
      enabled: true,
    },
  ],
});

// Register as a hook in AutoGen
const assistant = new AssistantAgent('DataAgent', {
  llmConfig,
  async functionCallHook(funcName, args) {
    const result = await shield.evaluate({
      agentRole: 'DataAgent',
      toolName: funcName,
      arguments: args,
    });

    if (result.decision === 'BLOCK') {
      console.log(\`Blocked: \${result.reason}\`);
      return false;
    }

    return true;
  },
});`,

    'OpenAI SDK': `import { AgentShield } from 'agentshield';
import OpenAI from 'openai';

// Hosted mode — connects to the AgentShield dashboard
const shield = new AgentShield({
  mode: 'hosted',
  serverUrl: 'http://localhost:3000',
  apiKey: process.env.AGENTSHIELD_API_KEY,
});

// Policy management via SDK
await shield.createPolicy({
  name: 'Block SQL DROP',
  agentRole: 'DataAgent',
  resource: 'PostgreSQL',
  action: 'DROP',
  permissionLevel: 'BLOCK',
  priority: 20,
  enabled: true,
});

// Intercept function calls
async function callWithGuard(
  agentRole: string,
  functionName: string,
  args: Record<string, unknown>
) {
  const result = await shield.evaluate({
    agentRole,
    toolName: functionName,
    arguments: args,
  });

  if (result.decision === 'BLOCK') {
    return { error: \`Blocked: \${result.reason}\` };
  }

  return await executeFunction(functionName, args);
}`,
  },

  Python: {
    LangChain: `from agentshield.langchain import AgentShieldCallbackHandler

# Create a callback handler with embedded policies
handler = AgentShieldCallbackHandler(
    mode="embedded",
    policies=[
        {
            "policyId": "POL-001",
            "name": "Block SQL DROP",
            "agentRole": "DataAgent",
            "resource": "PostgreSQL",
            "action": "DROP",
            "permissionLevel": "BLOCK",
            "priority": 20,
            "enabled": True,
        },
    ],
    tool_name_map={"sql_db_query": "PostgreSQL"},
)

# Use with LangChain agent
agent_executor = AgentExecutor.from_agent_and_tools(
    agent=agent,
    tools=tools,
    callbacks=[handler],
)`,

    CrewAI: `from agentshield import AgentShield

# Create a shield in hosted mode
shield = AgentShield(
    mode="hosted",
    server_url="http://localhost:3000",
    api_key=os.environ["AGENTSHIELD_API_KEY"],
)

# Add guard to CrewAI agent
@agent
class DataAgent:
    role = "Data Analysis Expert"

    def before_tool_call(self, tool_name: str, args: dict):
        result = shield.evaluate(
            agent_role="DataAgent",
            tool_name=tool_name,
            arguments=args,
        )

        if result.decision == "BLOCK":
            return {"blocked": True, "reason": result.reason}

        if result.decision == "REQUIRE_APPROVAL":
            return {"require_approval": True, "trace_id": result.trace_id}

        return {"allowed": True}`,

    AutoGen: `from agentshield import AgentShield

# Create a shield with embedded policies
shield = AgentShield(
    mode="embedded",
    policies=[
        {
            "policyId": "POL-001",
            "name": "Block SQL DROP",
            "agentRole": "DataAgent",
            "resource": "PostgreSQL",
            "action": "DROP",
            "permissionLevel": "BLOCK",
            "priority": 20,
            "enabled": True,
        },
    ],
)

# Register as a hook in AutoGen
def guard_hook(sender, message, recipient):
    if message.get("function_call"):
        func_name = message["function_call"]["name"]
        args = json.loads(message["function_call"]["arguments"])

        result = shield.evaluate(
            agent_role="DataAgent",
            tool_name=func_name,
            arguments=args,
        )

        if result.decision == "BLOCK":
            return False  # Block the function call

    return True

# Register the hook
assistant.register_hook("process_message", guard_hook)`,

    'OpenAI SDK': `from agentshield import AgentShield
import openai

# Hosted mode — connects to the AgentShield dashboard
shield = AgentShield(
    mode="hosted",
    server_url="http://localhost:3000",
    api_key=os.environ["AGENTSHIELD_API_KEY"],
)

# Policy management via SDK
shield.create_policy(
    name="Block SQL DROP",
    agent_role="DataAgent",
    resource="PostgreSQL",
    action="DROP",
    permission_level="BLOCK",
    priority=20,
    enabled=True,
)

# Intercept function calls
def call_with_guard(agent_role, function_name, args):
    """Execute function call with policy guard."""
    result = shield.evaluate(
        agent_role=agent_role,
        tool_name=function_name,
        arguments=args,
    )

    if result.decision == "BLOCK":
        return {"error": f"Blocked: {result.reason}"}

    # Execute the function call
    return execute_function(function_name, args)`,
  },
}

const getInstallCommand = (language: Language, framework: Framework): string => {
  if (language === 'TypeScript') {
    return framework === 'LangChain'
      ? 'npm install @agentshield/langchain agentshield'
      : 'npm install agentshield'
  }
  return framework === 'LangChain'
    ? 'pip install "agentshield[langchain]"'
    : 'pip install agentshield'
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity active:scale-95"
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  )
}

function EvaluatePlayground() {
  const [agentRole, setAgentRole] = useState('DataAgent')
  const [toolName, setToolName] = useState('PostgreSQL')
  const [args, setArgs] = useState('{"operation": "SELECT"}')
  const [result, setResult] = useState<Record<string, unknown> | null>(null)

  const evalMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: (data) => {
      setResult(data)
      toast.success('Evaluation complete')
    },
    onError: () => toast.error('Evaluation failed'),
  })

  const handleEval = () => {
    let parsedArgs = {}
    try {
      parsedArgs = JSON.parse(args)
    } catch {
      toast.error('Invalid JSON')
      return
    }
    evalMutation.mutate({ agentRole, toolName, arguments: parsedArgs })
  }

  return (
    <Card className="border-0 shadow-sm glass-card glow-hover hover:shadow-md transition-shadow duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Play className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Interactive Playground
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Agent Role</Label>
            <Select value={agentRole} onValueChange={setAgentRole}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DataAgent">DataAgent</SelectItem>
                <SelectItem value="CodeAgent">CodeAgent</SelectItem>
                <SelectItem value="FinanceAgent">FinanceAgent</SelectItem>
                <SelectItem value="SupportAgent">SupportAgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tool Name</Label>
            <Input className="h-8 text-sm" value={toolName} onChange={(e) => setToolName(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Arguments (JSON)</Label>
          <Input className="h-8 text-sm font-mono" value={args} onChange={(e) => setArgs(e.target.value)} />
        </div>
        <Button
          className="w-full h-8 text-sm bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-transform"
          onClick={handleEval}
          disabled={evalMutation.isPending}
        >
          {evalMutation.isPending ? 'Evaluating...' : 'Run Evaluation'}
          <Zap className="h-3 w-3 ml-1" />
        </Button>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="bg-muted/50 dark:bg-muted/30 rounded-lg p-3 text-xs font-mono overflow-x-auto custom-scrollbar max-h-48"
            >
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

export function SDKIntegration() {
  const [language, setLanguage] = useState<Language>('TypeScript')
  const [framework, setFramework] = useState<Framework>('LangChain')
  const [copiedInstall, setCopiedInstall] = useState(false)

  const code = codeSnippets[language][framework]
  const installCmd = getInstallCommand(language, framework)

  const copyInstall = () => {
    navigator.clipboard.writeText(installCmd)
    setCopiedInstall(true)
    setTimeout(() => setCopiedInstall(false), 2000)
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="section-header-gradient rounded-xl px-4 py-3 -mx-4 -mt-2 md:-mx-6 md:-mt-4 mb-2">
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 bg-gradient-to-r from-emerald-700 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
          <Code2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          SDK & Integration
        </h2>
        <p className="text-sm text-muted-foreground">
          Integrate AgentShield into your AI agent frameworks
        </p>
      </div>

      {/* Architecture Diagram */}
      <Card className="border-0 shadow-sm glass-card glow-hover hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Box className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Architecture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 flex-wrap py-4">
            {[
              { label: 'AI Agent', color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' },
              { label: '→', color: '' },
              { label: 'agentshield', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
              { label: '→', color: '' },
              { label: 'Policy Engine', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
              { label: '→', color: '' },
              { label: 'Decision', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20' },
            ].map((item, i) =>
              item.color ? (
                <Badge key={i} variant="outline" className={`${item.color} px-3 py-1.5 text-xs font-medium transition-transform duration-150 hover:scale-105`}>
                  {item.label}
                </Badge>
              ) : (
                <ArrowRight key={i} className="h-4 w-4 text-muted-foreground" />
              )
            )}
          </div>
          <div className="flex items-center justify-center gap-4 mt-2 flex-wrap text-xs text-muted-foreground">
            <span className="text-emerald-600 dark:text-emerald-400">ALLOW → Proceed</span>
            <span className="text-red-600 dark:text-red-400">BLOCK → Reject</span>
            <span className="text-amber-600 dark:text-amber-400">REQUIRE_APPROVAL → Human Review → Webhook</span>
          </div>
          <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
            <Badge variant="outline" className="text-[10px] bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
              mode: &apos;embedded&apos; — No server needed
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20">
              mode: &apos;hosted&apos; — Dashboard connection
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Docker Deployment */}
      <Card className="border-0 shadow-sm glass-card glow-hover hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Container className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Docker Deployment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="relative group bg-muted/50 dark:bg-muted/30 rounded-lg p-3 font-mono text-sm">
              <span className="text-xs">docker compose up</span>
              <CopyButton text="docker compose up" />
            </div>
            <p className="text-xs text-muted-foreground">
              The dashboard will be available at <code className="font-mono text-[10px]">http://localhost:3000</code>.
              Includes a Dockerfile for custom deployments.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[10px] bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                Next.js App
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20">
                WebSocket Service
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-cyan-500/5 text-cyan-600 dark:text-cyan-400 border-cyan-500/20">
                SQLite Volume
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Installation */}
      <Card className="border-0 shadow-sm glass-card glow-hover hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Installation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-3 overflow-x-auto">
            {LANGUAGES.map((lang) => (
              <Button
                key={lang}
                variant={language === lang ? 'default' : 'outline'}
                size="sm"
                className={`h-7 text-xs shrink-0 active:scale-[0.98] transition-transform ${language === lang ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                onClick={() => setLanguage(lang)}
              >
                {lang}
              </Button>
            ))}
          </div>
          <div className="relative group bg-muted/50 dark:bg-muted/30 rounded-lg p-3 font-mono text-sm flex items-center justify-between">
            <span className="text-xs overflow-x-auto">{installCmd}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2 active:scale-95" onClick={copyInstall}>
              {copiedInstall ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          {framework === 'LangChain' && (
            <p className="text-[10px] text-muted-foreground mt-2">
              The <code className="font-mono">agentshield</code> core package is included as a dependency of <code className="font-mono">@agentshield/langchain</code>.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Framework Selector - scrollable on mobile */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {FRAMEWORKS.map((fw) => (
          <Button
            key={fw}
            variant={framework === fw ? 'secondary' : 'ghost'}
            size="sm"
            className={`h-7 text-xs shrink-0 active:scale-[0.98] transition-transform ${framework === fw ? 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400' : ''}`}
            onClick={() => setFramework(fw)}
          >
            {fw}
          </Button>
        ))}
      </div>

      {/* Code Block - horizontally scrollable */}
      <Card className="border-0 shadow-sm glass-card glow-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{language}</Badge>
            <span>with {framework}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative group overflow-x-auto">
            <CopyButton text={code} />
            <SyntaxHighlighter
              language={language === 'TypeScript' ? 'typescript' : 'python'}
              style={atomOneDark}
              showLineNumbers
              customStyle={{
                margin: 0,
                borderRadius: '0 0 0.5rem 0.5rem',
                fontSize: '12px',
              }}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Playground + API Reference */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <EvaluatePlayground />

        {/* API Reference */}
        <Card className="border-0 shadow-sm glass-card glow-hover hover:shadow-md transition-shadow duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">SDK & API Reference</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                AgentShield SDK Methods
              </h4>
              <div className="space-y-1.5">
                <pre className="text-[10px] font-mono bg-muted/50 dark:bg-muted/30 rounded p-2 overflow-x-auto">
{`// Initialize
new AgentShield({ mode, serverUrl, apiKey, policies })

// Evaluate a tool call
await shield.evaluate({
  agentRole, toolName, arguments
})

// Policy management
await shield.createPolicy({ ... })
await shield.listPolicies()

// Trace inspection
await shield.getTrace(traceId)`}
                </pre>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                POST /api/evaluate
              </h4>
              <p className="text-xs text-muted-foreground">
                Evaluate a tool call against active policies.
              </p>
              <pre className="text-[10px] font-mono bg-muted/50 dark:bg-muted/30 rounded p-2 overflow-x-auto">
{`{
  "agentRole": "DataAgent",
  "toolName": "PostgreSQL",
  "arguments": { "query": "DROP TABLE users" }
}`}
              </pre>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                WebSocket Events
              </h4>
              <p className="text-xs text-muted-foreground">
                Connect to <code className="font-mono text-[10px]">/?XTransformPort=3003</code>
              </p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px] transition-transform duration-150 hover:scale-105">approval:new</Badge>
                <Badge variant="outline" className="text-[10px] transition-transform duration-150 hover:scale-105">approval:updated</Badge>
                <Badge variant="outline" className="text-[10px] transition-transform duration-150 hover:scale-105">approval:reminder</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
