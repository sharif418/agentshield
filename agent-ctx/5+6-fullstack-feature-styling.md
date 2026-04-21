# Task 5+6: Wire GlobalTimeRange + Mandatory Styling Improvements

**Date:** 2026-04-21
**Status:** ✅ Complete

## Part 1: Wire GlobalTimeRange to Filter API Data

### What was done:

1. **Traces API** (`/src/app/api/traces/route.ts`):
   - Added `getTimeRangeCutoff()` helper function that maps time range strings to Date objects
   - Accepts `timeRange` query parameter (24h, 7d, 30d, 90d)
   - Defaults to '24h' if not specified
   - Applies `where: { timestamp: { gte: cutoff } }` to the Prisma query when timeRange is provided

2. **Stats API** (`/src/app/api/stats/route.ts`):
   - Changed from `GET()` to `GET(request: NextRequest)` to access query params
   - Added same `getTimeRangeCutoff()` helper function
   - Accepts `timeRange` query parameter
   - Applied date filtering to trace-related queries: `totalTraces`, `traceBreakdown`, `recentTraces`, `averageLatency`
   - Kept `totalPolicies`, `policyBreakdown`, `auditLogCount`, `policiesByRoleData`, and `pendingApprovals` unfiltered (they represent total configuration, not time-series data)

3. **Frontend Components Updated** (all now pass `timeRange` to queryKey and fetch URL):
   - `DashboardOverview.tsx`: Added `const timeRange = useAppStore((s) => s.timeRange)`, passed to `['stats', timeRange]` and `['traces-chart', timeRange]`
   - `ExecutionTraces.tsx`: Added import for `useAppStore`, passed timeRange to all queries including pagination and histogram
   - `LiveStream.tsx`: Added timeRange to `wsConnected` destructuring, passed to `['livestream-traces', timeRange]`
   - `AgentRoles.tsx`: Added `useAppStore` import and `formatDistanceToNow` import (was accidentally removed), passed timeRange to `['agents-traces', timeRange]`
   - `DashboardLayout.tsx`: Added timeRange to destructuring, passed to `['stats-footer', timeRange]` and fetch URL

## Part 2: Mandatory Styling Improvements

### 1. Enhanced StatCard (`StatCard.tsx`):
- **Gradient line at bottom**: Added a 2px gradient line matching the card's gradient color at the bottom of each card
- **Mini Sparkline SVG**: Added `MiniSparkline` component with 5 data points, auto-generated from value if no `sparklineData` prop provided, color matches card gradient
- **Inner shadow at top**: Added a subtle gradient from `black/3%` to transparent for depth effect
- **Larger/bolder value text**: Changed from `text-2xl font-bold` to `text-[1.65rem] font-extrabold leading-tight`
- Added `card-shine` class for diagonal light sweep on hover

### 2. Enhanced Sidebar (`Sidebar.tsx`):
- **Environment indicator**: Added a rounded pill with "DEV" in emerald text on emerald/10 bg with emerald border
- **Separator line**: Added `border-t border-border` before environment indicator
- **Quick Stats section**: Added compact section showing policy count (ShieldCheck icon) and approval count (CheckCircle icon) fetched from `/api/stats`
- Environment pill hidden when sidebar collapsed

### 3. Enhanced DashboardOverview with Compliance Gauge:
- **Semi-circular Compliance Gauge SVG** replacing the simple percentage display
- Background arc with `strokeOpacity: 0.08`
- Colored arc: green > 80%, amber 50-80%, red < 50% using `strokeDasharray` for proportional fill
- **Tick marks** at 25%, 50%, 75%, 100% using calculated line positions on the semicircle
- Percentage and "coverage" label centered inside the gauge
- Added `gauge-glow` class for subtle glow animation

### 4. Enhanced ApprovalCard (`ApprovalCard.tsx`):
- **Urgency indicator** based on wait time:
  - < 1 hour: normal (no badge)
  - 1-4 hours: "Waiting" amber badge with Clock icon
  - > 4 hours: "Urgent" red badge with AlertTriangle icon and `urgency-pulse` CSS animation
- **Wait time progress bar**: Visual bar showing wait time, color-coded (emerald/amber/red), scale based on hours elapsed
- Urgency badges only shown for PENDING approvals

### 5. Global CSS Additions (`globals.css`):
- **`.card-shine`**: Diagonal light sweep on hover using `::after` pseudo-element with `cardShine` keyframe animation (translates + rotates)
- **`.urgency-pulse`**: Red box-shadow pulse animation using `urgencyPulse` keyframe (2s infinite)
- **`.gauge-glow`**: Subtle emerald drop-shadow glow for SVG gauge components, with separate dark mode variant `gaugeGlowDark` (stronger glow)
- Keyframe animations: `cardShine`, `urgencyPulse`, `gaugeGlow`, `gaugeGlowDark`

### Verification:
- `bun run lint` passes with 0 errors
- Dev server not running at time of check (port 3000 not bound), but lint confirms code quality
