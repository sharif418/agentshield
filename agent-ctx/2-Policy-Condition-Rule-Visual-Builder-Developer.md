---
Task ID: 2
Agent: Policy Condition Rule Visual Builder Developer
Task: Add Policy Condition Rule Visual Builder component

Work Log:
- Read worklog.md to understand project history and current state (11-section dashboard with full-stack functionality)
- Read PolicyForm.tsx to understand existing conditionRules handling (raw JSON textarea with validation)
- Read evaluate/route.ts to understand condition operators ($and, $or, $contains, $equals, $in, $gt, $lt)
- Created ConditionRuleBuilder component at src/components/dashboard/ConditionRuleBuilder.tsx (~350 lines)
- Designed internal tree data structure: ConditionLeaf (field, operator, value) and ConditionGroup (operator, children)
- Implemented JSON↔Tree bidirectional conversion (parseJsonToNode, nodeToJson) supporting all operators
- Built visual condition rows with field input (with datalist suggestions), operator dropdown, value input, delete button
- Built GroupNode component with AND/OR toggle, collapsible sections, nested group support
- Added Framer Motion AnimatePresence animations for add/remove conditions
- Applied color scheme: emerald for AND groups, amber for OR groups (border + background)
- Added "Visual" / "Raw JSON" toggle mode for advanced users
- Added real-time JSON preview panel at bottom
- Added empty state with Add Condition / Add Group buttons
- Added field name suggestions datalist (operation, recipient_domain, amount, currency, etc.)
- Integrated ConditionRuleBuilder into PolicyForm.tsx, replacing raw JSON textarea
- Removed jsonError state and validateConditionRules from PolicyForm (builder handles validation internally)
- Removed unused Badge import from PolicyForm
- Kept submit-time JSON validation as safety net
- Ran bun run lint: passes with 0 errors

Stage Summary:
- Created src/components/dashboard/ConditionRuleBuilder.tsx - Full visual condition rule builder component
- Modified src/components/dashboard/PolicyForm.tsx - Replaced raw JSON textarea with ConditionRuleBuilder, removed unused imports and state
- Lint passes with 0 errors
- Component supports all condition operators: $and, $or, $contains, $equals, $in, $gt, $lt
- Visual mode shows tree with AND/OR groups, condition rows, add/remove buttons
- Raw JSON mode available via toggle for advanced users
- Values sync bidirectionally between visual and raw modes
