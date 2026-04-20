'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Code2, Copy, Check, Play, Zap, Terminal, Box, ArrowRight } from 'lucide-react'
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
    LangChain: `import { AgentShieldGuard } from '@agentshield/sdk';

// Initialize the guard with your policy engine URL
const guard = new AgentShieldGuard({
  endpoint: 'http://localhost:3000',
  apiKey: process.env.AGENTSHIELD_API_KEY,
});

// Wrap your LangChain tool calls
const result = await guard.evaluate({
  agentRole: 'DataAgent',
  toolName: 'PostgreSQL',
  arguments: { operation: 'SELECT', query: 'SELECT * FROM users' },
});

if (result.decision === 'BLOCK') {
  throw new Error(\`Action blocked: \${result.reason}\`);
}

if (result.decision === 'REQUIRE_APPROVAL') {
  // Wait for human approval
  const approval = await guard.waitForApproval(result.traceId);
  if (approval.status !== 'APPROVED') {
    throw new Error('Action not approved');
  }
}

// Proceed with the tool call
const toolResult = await tool.call(args);`,

    CrewAI: `import { AgentShieldGuard } from '@agentshield/sdk';

const guard = new AgentShieldGuard({
  endpoint: 'http://localhost:3000',
});

// Add to your CrewAI agent callback
const agent = new Agent({
  name: 'DataAgent',
  role: 'Data Analysis Expert',
  async beforeToolCall(toolName, args) {
    const result = await guard.evaluate({
      agentRole: 'DataAgent',
      toolName,
      arguments: args,
    });

    if (result.decision === 'BLOCK') {
      return { blocked: true, reason: result.reason };
    }

    if (result.decision === 'REQUIRE_APPROVAL') {
      const approval = await guard.waitForApproval(result.traceId);
      return { approved: approval.status === 'APPROVED' };
    }

    return { allowed: true };
  },
});`,

    AutoGen: `import { AgentShieldGuard } from '@agentshield/sdk';

const guard = new AgentShieldGuard({
  endpoint: 'http://localhost:3000',
});

// Register as a hook in AutoGen
const assistant = new AssistantAgent(
  'DataAgent',
  {
    llmConfig,
    async functionCallHook(funcName, args) {
      const result = await guard.evaluate({
        agentRole: 'DataAgent',
        toolName: funcName,
        arguments: args,
      });

      if (result.decision === 'BLOCK') {
        console.log(\`Blocked: \${result.reason}\`);
        return false;
      }

      if (result.decision === 'REQUIRE_APPROVAL') {
        const approval = await guard.waitForApproval(
          result.traceId
        );
        return approval.status === 'APPROVED';
      }

      return true;
    },
  }
);`,

    'OpenAI SDK': `import { AgentShieldGuard } from '@agentshield/sdk';
import OpenAI from 'openai';

const guard = new AgentShieldGuard({
  endpoint: 'http://localhost:3000',
});

const openai = new OpenAI();

// Intercept function calls
async function callWithGuard(
  agentRole: string,
  functionName: string,
  args: Record<string, unknown>
) {
  const result = await guard.evaluate({
    agentRole,
    toolName: functionName,
    arguments: args,
  });

  if (result.decision === 'BLOCK') {
    return { error: \`Blocked: \${result.reason}\` };
  }

  if (result.decision === 'REQUIRE_APPROVAL') {
    const approval = await guard.waitForApproval(result.traceId);
    if (approval.status !== 'APPROVED') {
      return { error: 'Not approved' };
    }
  }

  // Execute the function call
  return await executeFunction(functionName, args);
}`,
  },

  Python: {
    LangChain: `from agentshield import AgentShieldGuard

# Initialize the guard
guard = AgentShieldGuard(
    endpoint="http://localhost:3000",
    api_key=os.environ["AGENTSHIELD_API_KEY"],
)

# Evaluate before tool execution
@tool
def query_database(query: str) -> str:
    """Query the PostgreSQL database."""
    result = guard.evaluate(
        agent_role="DataAgent",
        tool_name="PostgreSQL",
        arguments={"operation": "SELECT", "query": query},
    )

    if result.decision == "BLOCK":
        raise ValueError(f"Action blocked: {result.reason}")

    if result.decision == "REQUIRE_APPROVAL":
        approval = guard.wait_for_approval(result.trace_id)
        if approval.status != "APPROVED":
            raise ValueError("Action not approved")

    # Execute the query
    return execute_query(query)`,

    CrewAI: `from agentshield import AgentShieldGuard

guard = AgentShieldGuard(endpoint="http://localhost:3000")

# Add guard to CrewAI agent
@agent
class DataAgent:
    role = "Data Analysis Expert"

    def before_tool_call(self, tool_name: str, args: dict):
        result = guard.evaluate(
            agent_role="DataAgent",
            tool_name=tool_name,
            arguments=args,
        )

        if result.decision == "BLOCK":
            return {"blocked": True, "reason": result.reason}

        if result.decision == "REQUIRE_APPROVAL":
            approval = guard.wait_for_approval(result.trace_id)
            return {"approved": approval.status == "APPROVED"}

        return {"allowed": True}`,

    AutoGen: `from agentshield import AgentShieldGuard

guard = AgentShieldGuard(endpoint="http://localhost:3000")

# Register as a hook in AutoGen
def guard_hook(sender, message, recipient):
    if message.get("function_call"):
        func_name = message["function_call"]["name"]
        args = json.loads(message["function_call"]["arguments"])

        result = guard.evaluate(
            agent_role="DataAgent",
            tool_name=func_name,
            arguments=args,
        )

        if result.decision == "BLOCK":
            return False  # Block the function call

        if result.decision == "REQUIRE_APPROVAL":
            approval = guard.wait_for_approval(result.trace_id)
            return approval.status == "APPROVED"

    return True

# Register the hook
assistant.register_hook("process_message", guard_hook)`,

    'OpenAI SDK': `from agentshield import AgentShieldGuard
import openai

guard = AgentShieldGuard(endpoint="http://localhost:3000")
client = openai.OpenAI()

def call_with_guard(agent_role, function_name, args):
    """Execute function call with policy guard."""
    result = guard.evaluate(
        agent_role=agent_role,
        tool_name=function_name,
        arguments=args,
    )

    if result.decision == "BLOCK":
        return {"error": f"Blocked: {result.reason}"}

    if result.decision == "REQUIRE_APPROVAL":
        approval = guard.wait_for_approval(result.trace_id)
        if approval.status != "APPROVED":
            return {"error": "Not approved"}

    # Execute the function call
    return execute_function(function_name, args)`,
  },
}

const installCommands = {
  TypeScript: 'npm install @agentshield/sdk',
  Python: 'pip install agentshield',
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
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-300">
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
  const installCmd = installCommands[language]

  const copyInstall = () => {
    navigator.clipboard.writeText(installCmd)
    setCopiedInstall(true)
    setTimeout(() => setCopiedInstall(false), 2000)
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Code2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          SDK & Integration
        </h2>
        <p className="text-sm text-muted-foreground">
          Integrate AgentShield into your AI agent frameworks
        </p>
      </div>

      {/* Architecture Diagram */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-300">
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
              { label: 'AgentShield SDK', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
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
        </CardContent>
      </Card>

      {/* Installation */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-300">
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
      <Card className="border-0 shadow-sm">
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
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">API Reference</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
  "arguments": { "operation": "SELECT" }
}`}
              </pre>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                PUT /api/approvals/:id
              </h4>
              <p className="text-xs text-muted-foreground">
                Approve, reject, or modify a pending approval request.
              </p>
              <pre className="text-[10px] font-mono bg-muted/50 dark:bg-muted/30 rounded p-2 overflow-x-auto">
{`{
  "status": "APPROVED" | "REJECTED" | "MODIFIED",
  "humanReviewerId": "reviewer-id"
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
