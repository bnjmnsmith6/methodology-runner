# Constellation Packet — RP-6: Orchestrator Integration
**Project:** GUPPI Vision Conversation Mode
**Tier:** 1
**Date:** 2026-03-25
**Dependencies:** RP-1 through RP-5 (all must be complete)

---

## Context Block

RPs 1-5 built all the pieces: database, classifier, conversation engine, Vision Document generator, decomposition engine, and context injection. None of it is wired into the actual chat interface yet. The user still types "create a project" and the old flow runs.

This RP is the integration layer. It modifies the chat orchestrator's system prompt and tools so that every new project request flows through the Vision Conversation system. It replaces the auto-skip of Steps 1 (VISION) and 2 (DECOMPOSE) with the real intake flow.

This is Tier 1 because all the logic already exists — we're just wiring it together and updating the system prompt. No new algorithms, no new LLM calls beyond what RP-3/4 already handle.

**Tech Stack:** TypeScript, Express chat server, existing chat tools, imports from all previous RPs

---

## Implementation Spec

### What to Build

1. New chat tools for the vision conversation flow
2. Updated orchestrator system prompt
3. Modified project creation flow
4. End-to-end integration

### Build Order

**Step 1: New chat tool — start_vision**

Add to `src/chat/tools.ts`:

```typescript
// Tool: start_vision
// Called when the user describes something they want to build
// Replaces the immediate create_project flow for new requests
{
  name: 'start_vision',
  description: 'Start the vision conversation to understand what the user wants to build. Call this when the user describes a new project idea.',
  parameters: {
    type: 'object',
    properties: {
      user_message: { type: 'string', description: 'The user\'s project description or idea' }
    },
    required: ['user_message']
  },
  handler: async (params) => {
    const result = await handleNewIntake(params.user_message);
    
    if (result.type === 'fast-path') {
      // Skip conversation — build the fast-path vision doc and create project immediately
      const visionDoc = buildFastPathVision(parseRequest(params.user_message));
      // Save vision doc
      // Create project with one RP
      // Start project
      // Return confirmation
    } else {
      // Return the first question to the user
      // The orchestrator will relay this to the user
      return {
        sessionId: result.sessionId,
        message: result.message,
        quickOptions: result.quickOptions,
        status: 'asking'
      };
    }
  }
}
```

**Step 2: New chat tool — continue_vision**

```typescript
// Tool: continue_vision
// Called when the user responds during an active vision session
{
  name: 'continue_vision',
  description: 'Continue the vision conversation with the user\'s reply. Call this when there is an active vision session and the user is answering questions.',
  parameters: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'The active vision session ID' },
      user_reply: { type: 'string', description: 'The user\'s reply' }
    },
    required: ['session_id', 'user_reply']
  },
  handler: async (params) => {
    const result = await handleIntakeReply(params.session_id, params.user_reply);
    
    if (result.visionSessionComplete) {
      // Session is done — build Vision Document and decompose
      const session = await getSessionWithMessages(params.session_id);
      const visionDoc = await buildVisionDocument(session.session, session.messages, session.session.coverage);
      const decomposition = await decomposeProject(visionDoc);
      
      // Show user the summary and decomposition
      const summary = renderShortSummary(visionDoc);
      const decompositionText = decomposition.userSummary;
      
      return {
        status: 'ready_to_create',
        visionDocId: visionDoc.id,
        summary: summary,
        decomposition: decompositionText,
        proposalCount: decomposition.proposals.length,
        message: `${summary}\n\n${decompositionText}\n\nLook good? Say "yes" to create the project, or tell me what to change.`
      };
    } else {
      // More questions needed
      return {
        sessionId: params.session_id,
        message: result.message,
        quickOptions: result.quickOptions,
        status: 'asking'
      };
    }
  }
}
```

**Step 3: New chat tool — approve_vision**

```typescript
// Tool: approve_vision
// Called when the user approves the vision and decomposition
{
  name: 'approve_vision',
  description: 'Create the project and RPs from the approved vision. Call this when the user confirms the vision summary and decomposition look good.',
  parameters: {
    type: 'object',
    properties: {
      vision_doc_id: { type: 'string', description: 'The vision document ID to approve' },
      modifications: { type: 'string', description: 'Any modifications the user requested (optional)' }
    },
    required: ['vision_doc_id']
  },
  handler: async (params) => {
    // 1. Load the Vision Document
    const visionDoc = await getVisionDocument(params.vision_doc_id);
    
    // 2. Load the decomposition
    // (get the latest decomposition_decision for this vision doc)
    
    // 3. Create the project
    const project = await createProject({
      name: visionDoc.intent.project_title,
      description: visionDoc.intent.one_sentence_brief,
      tier: maxTierFromProposals(decomposition.proposals)
    });
    
    // 4. Create all RPs from proposals
    const rpIdMap = {};
    for (const proposal of decomposition.proposals) {
      const rp = await createRP({
        project_id: project.id,
        title: proposal.title,
        description: proposal.description,
        tier: proposal.tier,
        source_vision_doc_id: visionDoc.id
      });
      rpIdMap[proposal.title] = rp.id;
    }
    
    // 5. Create RP dependencies
    for (const proposal of decomposition.proposals) {
      for (const dep of proposal.dependencies) {
        if (rpIdMap[dep.rpTitle]) {
          await addRPDependency(rpIdMap[proposal.title], rpIdMap[dep.rpTitle], dep.reason);
        }
      }
    }
    
    // 6. Generate and save context packs for all RPs
    await generateAndSaveContextPacks(project.id, visionDoc, decomposition.proposals, rpIdMap);
    
    // 7. Approve the decomposition decision
    await approveDecomposition(decomposition.id);
    
    // 8. Update vision document with project_id
    await updateVisionDocProject(visionDoc.id, project.id);
    
    // 9. Start the project (activates worker processing)
    await startProject(project.id);
    
    return {
      status: 'created',
      projectId: project.id,
      rpCount: decomposition.proposals.length,
      message: `Project "${visionDoc.intent.project_title}" created with ${decomposition.proposals.length} RP(s). The worker is now processing. I'll let you know when decisions need your input.`
    };
  }
}
```

**Step 4: Update orchestrator system prompt**

Modify the system prompt in `src/chat/system-prompt.ts` (or wherever it lives). Add these instructions:

```
## How to Handle New Project Requests

When the user describes something they want to build:

1. ALWAYS call start_vision first. Do NOT call create_project directly.
2. If start_vision returns status "fast-path": relay the confirmation and the project starts immediately.
3. If start_vision returns status "asking": relay the question to the user EXACTLY as written. Do not rephrase it. Do not add your own questions. The vision system handles the conversation.
4. When the user replies during an active vision session: call continue_vision with their reply.
5. When continue_vision returns status "ready_to_create": show the user the summary and decomposition. Ask for approval.
6. When the user approves: call approve_vision. The project and all RPs are created and the worker starts.
7. If the user wants changes: relay the modification to continue_vision or restart the session.

IMPORTANT:
- Do NOT skip the vision step. Even simple requests benefit from fast-path classification.
- Do NOT add your own questions on top of the vision system's questions. One question at a time.
- Do NOT create projects with create_project unless the user explicitly says "skip vision" or "just create it."
- The old create_project tool still works as a fallback, but prefer the vision flow.

## Active Vision Sessions

If there is an active vision session (the system told you a session_id), always route the user's replies through continue_vision until the session completes.
```

**Step 5: Track active session in chat state**

The chat server needs to know when there's an active vision session so it routes replies correctly. Add session tracking:

```typescript
// In the chat server state (could be in-memory or per-conversation)
let activeVisionSessionId: string | null = null;

// When start_vision returns a sessionId, store it
// When continue_vision returns visionSessionComplete = true, clear it
// When the conversation restarts, check getActiveIntake()
```

**Step 6: Update the create_project tool**

Don't remove create_project — it's the fallback. But add a note to its description:

```typescript
description: 'Create a project directly without vision conversation. Use start_vision instead for normal requests. Only use this when the user explicitly wants to skip the vision step.'
```

**Step 7: Handle conversation restart**

When the chat server starts or when a new browser session connects, check for active vision sessions:

```typescript
// On chat initialization:
const activeIntake = await getActiveIntake();
if (activeIntake.active) {
  // Tell the orchestrator there's an active session
  // The system prompt should instruct it to resume
}
```

### File Structure

```
src/
  chat/
    tools.ts              # MODIFIED — add start_vision, continue_vision, approve_vision tools
    system-prompt.ts       # MODIFIED — update orchestrator instructions (or wherever the system prompt lives)
```

---

## Constraints (What NOT to Do)

- DO NOT remove the existing create_project or start_project tools — they're fallbacks
- DO NOT add complex UI components — this is chat text only for now
- DO NOT build a separate frontend for vision — it runs through the existing chat
- DO NOT make the vision flow mandatory if the user explicitly says "just create it"
- DO NOT add more than 3 new tools
- DO NOT modify the worker, reducer, or adapter logic — RP-5 already handled context injection
- Keep the system prompt additions concise — the orchestrator is Sonnet, not Opus

---

## Stop and Ask List

1. **System prompt location.** Find where the orchestrator system prompt lives. It might be inline in the chat handler or in a separate file. Don't guess.
2. **Chat state management.** Find how the chat server currently manages state between messages. Is it in-memory? Session-based? The active session tracking needs to fit the existing pattern.
3. **Existing create_project handler.** Understand exactly what it does before modifying the flow. The new approve_vision handler replaces some of its functionality.

---

## Acceptance Criteria

- [ ] User says "Build me a dashboard" → start_vision triggers, asks a question
- [ ] User answers questions → continue_vision updates coverage and asks more or stops
- [ ] When conversation completes → Vision Doc + decomposition shown to user
- [ ] User says "yes" → approve_vision creates project and all RPs
- [ ] User says "Create hello.js that prints hello world" → fast-path, project created immediately
- [ ] All RPs have source_vision_doc_id set
- [ ] RP dependencies saved in rp_dependencies table
- [ ] Context packs generated for all RPs and consumers
- [ ] Worker picks up RPs and processes them with enriched context
- [ ] Old create_project tool still works as fallback
- [ ] Active vision session persists across server restart
- [ ] All 82+ existing tests still pass
- [ ] TypeScript compiles cleanly
- [ ] Chat conversation feels natural on mobile — short messages, one question at a time
